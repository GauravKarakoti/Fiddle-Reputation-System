"""
Database client using Prisma Client Python.
"""
from prisma import Prisma

db = Prisma(auto_register=True)


async def get_db() -> Prisma:
    """FastAPI dependency: yields the registered Prisma client instance."""
    # The client connection lifecycle (connect/disconnect) is managed in main.py lifespan.
    yield db


async def create_tables():
    """Table creation is managed externally using Prisma CLI (db push / migrate)."""
    pass
