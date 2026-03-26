"""
Database Configuration and Session Management

Supports both PostgreSQL (production) and SQLite (local development).
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool, StaticPool
import structlog

from app.core.config import settings

logger = structlog.get_logger()


def get_database_url() -> str:
    """Get the async database URL based on configuration."""
    db_url = settings.DATABASE_URL
    
    # SQLite support for local development (no Docker needed!)
    if db_url.startswith("sqlite"):
        # Convert to async SQLite
        if "+aiosqlite" not in db_url:
            db_url = db_url.replace("sqlite://", "sqlite+aiosqlite://")
        return db_url
    
    # PostgreSQL for production
    if db_url.startswith("postgresql://"):
        return db_url.replace("postgresql://", "postgresql+asyncpg://")
    
    return db_url


DATABASE_URL = get_database_url()
IS_SQLITE = "sqlite" in DATABASE_URL

# Engine configuration based on database type
engine_kwargs = {
    "echo": settings.DEBUG,
    "future": True
}

if IS_SQLITE:
    # SQLite needs special handling for async
    engine_kwargs["poolclass"] = StaticPool
    engine_kwargs["connect_args"] = {"check_same_thread": False}
    logger.info("Using SQLite database for local development")
else:
    engine_kwargs["poolclass"] = NullPool
    logger.info("Using PostgreSQL database")

# Create async engine
engine = create_async_engine(DATABASE_URL, **engine_kwargs)

# Create async session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

# Base class for models
Base = declarative_base()


async def init_db():
    """Initialize database tables."""
    logger.info("Initializing database", url=DATABASE_URL[:50] + "...")
    async with engine.begin() as conn:
        # Import all models here to ensure they're registered
        from app.models import article, claim, verification, source, domain
        await conn.run_sync(Base.metadata.create_all)
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
