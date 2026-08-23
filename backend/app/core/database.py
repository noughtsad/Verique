"""
Database configuration and session management.
"""
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool
import structlog

from app.core.config import settings

logger = structlog.get_logger()


def get_database_url() -> str:
    """Return an async SQLAlchemy database URL."""
    db_url = settings.DATABASE_URL

    if db_url.startswith("postgresql://"):
        return db_url.replace("postgresql://", "postgresql+asyncpg://")

    return db_url


DATABASE_URL = get_database_url()

engine_kwargs = {
    "echo": settings.DEBUG,
    "future": True,
    "poolclass": NullPool,
}

logger.info("Using PostgreSQL database")

engine = create_async_engine(DATABASE_URL, **engine_kwargs)

async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

Base = declarative_base()


async def init_db():
    """Validate database connectivity and load model metadata."""
    logger.info("Initializing database", url=DATABASE_URL[:50] + "...")
    from app.models import article, claim, verification, source, domain, user, post, moderation  # noqa: F401

    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    logger.info("Database initialized successfully")


async def get_db() -> AsyncSession:
    """Dependency to get database session."""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
