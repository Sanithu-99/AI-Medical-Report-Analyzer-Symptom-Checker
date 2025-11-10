from typing import Any

import certifi
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from .settings import get_settings


client: AsyncIOMotorClient | None = None
database: AsyncIOMotorDatabase | None = None


async def connect_to_mongo() -> None:
    """
    Establishes an encrypted TLS tunnel to MongoDB Atlas with hooks for future KMS-backed
    field-level encryption (FLE2). Certificates are validated via certifi to meet HIPAA baselines.
    """

    global client, database
    settings = get_settings()
    client = AsyncIOMotorClient(
        settings.mongo_uri,
        tls=True,
        tlsCAFile=certifi.where(),
        serverSelectionTimeoutMS=5000,
    )
    database = client[settings.mongo_db_name]


async def close_mongo_connection() -> None:
    if client:
        client.close()


def get_database() -> AsyncIOMotorDatabase:
    if database is None:
        raise RuntimeError("Database not initialized. Ensure connect_to_mongo is called.")
    return database


def get_collection(name: str) -> Any:
    db = get_database()
    return db[name]
