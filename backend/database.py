from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from .settings import get_settings


client: AsyncIOMotorClient | None = None
database: AsyncIOMotorDatabase | None = None


async def connect_to_mongo() -> None:
    global client, database
    settings = get_settings()
    client = AsyncIOMotorClient(settings.mongo_uri)
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
