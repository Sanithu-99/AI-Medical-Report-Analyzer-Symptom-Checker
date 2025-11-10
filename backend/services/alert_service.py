from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict

from ..database import get_collection


async def log_security_alert(
    event_type: str,
    *,
    user_id: str | None,
    email: str | None,
    ip: str | None,
    metadata: Dict[str, Any] | None = None,
) -> None:
    collection = get_collection("security_alerts")
    payload = {
        "event_type": event_type,
        "user_id": user_id,
        "email": email,
        "ip": ip,
        "metadata": metadata or {},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await collection.insert_one(payload)
