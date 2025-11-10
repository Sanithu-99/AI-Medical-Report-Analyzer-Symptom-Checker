import asyncio

from backend.database import connect_to_mongo, close_mongo_connection, get_database


async def _ping() -> None:
  await connect_to_mongo()
  db = get_database()
  await db.command("ping")
  print("MongoDB responded to ping()")
  await close_mongo_connection()


def main() -> None:
  asyncio.run(_ping())


if __name__ == "__main__":
  main()
