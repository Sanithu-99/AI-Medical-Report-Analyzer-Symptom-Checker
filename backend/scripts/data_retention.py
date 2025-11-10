from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

from backend.database import close_mongo_connection, connect_to_mongo, get_collection
from backend.settings import get_settings


async def purge_soft_deleted() -> None:
    settings = get_settings()
    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.soft_delete_grace_days)
    reports = get_collection("reports")
    phi_mapping = get_collection("phi_mapping")

    stale_reports = await reports.delete_many(
        {
            "storage_state": "pending_purge",
            "deleted_at": {"$lt": cutoff.isoformat()},
        }
    )
    stale_mappings = await phi_mapping.delete_many(
        {
            "created_at": {"$lt": (datetime.now(timezone.utc) - timedelta(days=settings.data_retention_days)).isoformat()}
        }
    )
    print(f"Purged {stale_reports.deleted_count} reports and {stale_mappings.deleted_count} PHI mappings.")


async def main():
    await connect_to_mongo()
    try:
        await purge_soft_deleted()
    finally:
        await close_mongo_connection()


if __name__ == "__main__":
    asyncio.run(main())
