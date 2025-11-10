import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

try:
    from slowapi import Limiter
    from slowapi.errors import RateLimitExceeded
    from slowapi.middleware import SlowAPIMiddleware
    from slowapi.util import get_remote_address

    SLOWAPI_AVAILABLE = True
except ModuleNotFoundError:  # pragma: no cover - optional dependency
    Limiter = None
    RateLimitExceeded = None
    SlowAPIMiddleware = None
    SLOWAPI_AVAILABLE = False

    def get_remote_address(request: Request) -> str:  # type: ignore[misc]
        return request.client.host if request.client else "0.0.0.0"

from .database import close_mongo_connection, connect_to_mongo
from .logging_config import configure_logging
from .middleware.security import AuditLogMiddleware, SecurityHeadersMiddleware
from .routers import auth, report_analyzer, symptom_checker
from .services.user_service import ensure_default_user
from .settings import get_settings


configure_logging()
settings = get_settings()
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"]) if SLOWAPI_AVAILABLE else None

app = FastAPI(
    title="Med Analyzr AI (HIPAA Edition)",
    description="Enterprise medical analysis platform with anonymised AI pipelines.",
    version="2.0.0",
)
if limiter:
    app.state.limiter = limiter

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SecurityHeadersMiddleware)
if SlowAPIMiddleware:
    app.add_middleware(SlowAPIMiddleware)
app.add_middleware(AuditLogMiddleware)

if not SLOWAPI_AVAILABLE:
    logging.warning("slowapi not installed; rate limiting middleware disabled.")

if RateLimitExceeded:

    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_handler(request: Request, exc: RateLimitExceeded):  # pragma: no cover - framework hook
        return JSONResponse({"detail": "Too many requests, please slow down."}, status_code=429)


@app.on_event("startup")
async def startup_event() -> None:
    await connect_to_mongo()
    await ensure_default_user()


@app.on_event("shutdown")
async def shutdown_event() -> None:
    await close_mongo_connection()


app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(report_analyzer.router, prefix="/api/reports", tags=["Reports"])
app.include_router(symptom_checker.router, prefix="/api/symptoms", tags=["Symptom Checker"])


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
