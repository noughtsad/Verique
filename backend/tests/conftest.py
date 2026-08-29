"""
Shared pytest fixtures for the chat test suite.

Uses an in-memory SQLite database scoped to just the tables the chat
feature needs (User, Conversation, Message), so tests don't depend on a
running Postgres instance.
"""
import os
import tempfile

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.database import Base, get_db
from app.core.security import get_password_hash
from app.main import app
from app.models.chat import Conversation, Message
from app.models.user import User


@pytest_asyncio.fixture
async def engine():
    # A real (temp) file rather than ":memory:" — an in-memory SQLite
    # connection is only visible to the connection that created it, which
    # breaks as soon as a test touches the DB from a second connection (e.g.
    # FastAPI's TestClient runs the ASGI app in its own thread/event loop for
    # WebSocket support). A temp file is visible to any connection that opens
    # it, matching how a real Postgres connection pool behaves.
    fd, db_path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    test_engine = create_async_engine(
        f"sqlite+aiosqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )
    async with test_engine.begin() as conn:
        await conn.run_sync(
            Base.metadata.create_all,
            tables=[User.__table__, Conversation.__table__, Message.__table__],
        )
    yield test_engine
    await test_engine.dispose()
    os.unlink(db_path)


@pytest_asyncio.fixture
async def session_maker(engine):
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture
async def db_session(session_maker):
    async with session_maker() as session:
        yield session


async def _make_user(db_session: AsyncSession, *, email: str, username: str) -> User:
    user = User(
        email=email,
        username=username,
        full_name=username.capitalize(),
        password_hash=get_password_hash("password123"),
        role="user",
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def user_a(db_session: AsyncSession) -> User:
    return await _make_user(db_session, email="alice@example.com", username="alice")


@pytest_asyncio.fixture
async def user_b(db_session: AsyncSession) -> User:
    return await _make_user(db_session, email="bob@example.com", username="bob")


@pytest_asyncio.fixture
async def user_c(db_session: AsyncSession) -> User:
    return await _make_user(db_session, email="carol@example.com", username="carol")


@pytest_asyncio.fixture
async def app_with_test_db(session_maker):
    """Point the FastAPI app's `get_db` dependency at the test database."""

    async def override_get_db():
        async with session_maker() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db
    yield app
    app.dependency_overrides.pop(get_db, None)


@pytest_asyncio.fixture
async def client_factory(app_with_test_db):
    """Yields a factory for independent AsyncClients (separate cookie jars),
    so tests can simulate two different logged-in users at once."""
    clients: list[AsyncClient] = []

    def _make() -> AsyncClient:
        transport = ASGITransport(app=app_with_test_db)
        new_client = AsyncClient(transport=transport, base_url="http://testserver")
        clients.append(new_client)
        return new_client

    yield _make

    for created_client in clients:
        await created_client.aclose()


@pytest_asyncio.fixture
async def client(client_factory):
    return client_factory()
