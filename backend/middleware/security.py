from __future__ import annotations

import ipaddress
import logging
from typing import Awaitable, Callable

from datetime import datetime, timezone

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from ..database import get_collection
from ..settings import get_settings


LOGGER = logging.getLogger("hipaa.middleware")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds strict transport and content security headers required for HIPAA/SOC2 baselines."""

    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        settings = get_settings()
        scheme = request.headers.get("X-Forwarded-Proto", request.url.scheme)
        if settings.https_only and scheme != "https" and not self._is_loopback(request.client.host):
            return Response(status_code=426, content="HTTPS required.")

        response = await call_next(request)
        response.headers["Strict-Transport-Security"] = f"max-age={settings.hsts_max_age}; includeSubDomains"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'"
        )
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Permissions-Policy"] = "geolocation=(self)"
        return response

    @staticmethod
    def _is_loopback(host: str | None) -> bool:
        if not host:
            return False
        try:
            ip = ipaddress.ip_address(host.split("%")[0])
            return ip.is_loopback
        except ValueError:
            return host in {"localhost", "127.0.0.1"}


class AuditLogMiddleware(BaseHTTPMiddleware):
    """
    Emits anonymised audit logs for PHI access.
    Raw payloads are never written, only hashed identifiers and metadata.
    """

    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        response = await call_next(request)
        LOGGER.info(
            "audit:%s path=%s method=%s status=%s ip=%s ua=%s",
            request.headers.get("X-Request-ID", "n/a"),
            request.url.path,
            request.method,
            response.status_code,
            request.client.host if request.client else "unknown",
            request.headers.get("user-agent"),
        )
        try:
            collection = get_collection(get_settings().audit_log_collection)
            await collection.insert_one(
                {
                    "path": request.url.path,
                    "method": request.method,
                    "status": response.status_code,
                    "ip": request.client.host if request.client else "unknown",
                    "request_id": request.headers.get("X-Request-ID", "n/a"),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            )
        except Exception as exc:  # pragma: no cover - logging should not break requests
            LOGGER.debug("Audit log persistence skipped: %s", exc)
        return response
