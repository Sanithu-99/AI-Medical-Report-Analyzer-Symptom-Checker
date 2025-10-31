from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import connect_to_mongo, close_mongo_connection
from .routers import auth, report_analyzer, symptom_checker
from .services.user_service import ensure_default_user
from .settings import get_settings


settings = get_settings()

app = FastAPI(
    title="AI Medical Report Analyzer and Symptom Checker",
    description="Upload medical reports, extract insights, and check symptoms.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
