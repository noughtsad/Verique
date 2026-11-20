"""
The admin dashboard's moderation API: reviews carry their challenges, can be listed as a
queue (open) or as history (resolved), and resolving one closes the challenges it answers.
"""
import os
import tempfile

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import app.models  # noqa: F401  (registers every table on Base.metadata)
from app.core.database import Base, get_db
from app.main import app
from app.models.moderation import Challenge, ModerationReview
from app.models.post import Post
from app.models.user import User
from app.schemas.social import ChallengeRequest, ModerationDecisionRequest
from app.schemas.verification import ClaimResult, ClaimSources, Verdict, VerificationSummary
from app.services.social_service import SocialService


@pytest.fixture(autouse=True)
def _groq_key(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "test-key")


@pytest_asyncio.fixture
async def sessions():
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    engine = create_async_engine(f"sqlite+aiosqlite:///{path}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    await engine.dispose()
    os.unlink(path)


@pytest_asyncio.fixture
async def db(sessions):
    async with sessions() as session:
        yield session


async def _user(db, name: str, role: str = "user") -> User:
    user = User(email=f"{name}@example.com", username=name, password_hash="x", role=role, is_active=True)
    db.add(user)
    await db.flush()
    return user


def _service(db) -> SocialService:
    service = SocialService(db)
    claim = ClaimResult(
        id="clm_1", span=[0, 10], text="The bridge opened in 1932.", verdict=Verdict.SUPPORTED,
        confidence=0.9, reasoning="Sources agree.", sources=ClaimSources(),
    )

    async def verify(**kwargs):
        return {"claims": [claim], "page_score": 80, "summary": VerificationSummary(supported=1),
                "models_used": [], "sources_checked": 1, "verification_errors": []}

    service.verification_service.verify = verify
    return service


async def _challenged_post(db, content: str = "The bridge opened in 1932."):
    """A verified post with one challenge, which (threshold 1) opens a review."""
    author = await db.scalar(select(User).where(User.username == "alice")) or await _user(db, "alice")
    post = Post(author_id=author.id, content=content)
    db.add(post)
    await db.flush()
    verification = await _service(db).verify_post(post.id, author)
    challenger = await _user(db, f"bob{post.id}")
    await SocialService(db).create_challenge(
        verification.id, challenger, ChallengeRequest(reason_code="missing_context", comment="Leaves out the 1933 reopening.")
    )
    review = await db.scalar(select(ModerationReview).where(ModerationReview.verification_id == verification.id))
    return post, verification, review


# --- service ------------------------------------------------------------------------

async def test_open_review_lists_its_challenges(db):
    post, _, review = await _challenged_post(db)

    [listed] = await SocialService(db).list_reviews("open")

    assert listed.id == review.id
    assert listed.post.id == post.id
    assert [(c.reason_code, c.comment, c.status) for c in listed.challenges] == [
        ("missing_context", "Leaves out the 1933 reopening.", "submitted"),
    ]
    assert listed.challenges[0].user.username == f"bob{post.id}"


async def test_resolving_moves_review_from_queue_to_history_and_closes_challenges(db):
    _, verification, review = await _challenged_post(db)
    moderator = await _user(db, "mod", role="admin")
    service = SocialService(db)

    resolved = await service.resolve_review(
        review.id, moderator,
        ModerationDecisionRequest(decision="revise", note="Missing the reopening.", override_score=40),
    )

    assert resolved.status == "resolved"
    assert resolved.moderator.username == "mod"
    assert [c.status for c in resolved.challenges] == ["resolved"]
    assert await service.list_reviews("open") == []
    [history] = await service.list_reviews("resolved")
    assert history.id == review.id and history.decision == "revise" and history.override_score == 40
    stored = await db.scalar(select(Challenge).where(Challenge.verification_id == verification.id))
    assert stored.status == "resolved"


async def test_a_new_challenge_after_a_decision_is_the_only_submitted_one(db):
    _, verification, review = await _challenged_post(db)
    moderator = await _user(db, "mod", role="moderator")
    service = SocialService(db)
    await service.resolve_review(review.id, moderator, ModerationDecisionRequest(decision="uphold", note="Checked it."))

    late = await _user(db, "carol")
    await service.create_challenge(verification.id, late, ChallengeRequest(reason_code="wrong_sources"))

    [reopened] = await service.list_reviews("open")
    assert [(c.user.username, c.status) for c in reopened.challenges] == [
        (f"bob{verification.post_id}", "resolved"),
        ("carol", "submitted"),
    ]
    assert reopened.decision == "uphold"  # the earlier decision stays visible while it is re-reviewed


async def test_queue_is_oldest_first_and_history_newest_decision_first(db):
    first = (await _challenged_post(db, "First claim."))[2]
    second = (await _challenged_post(db, "Second claim."))[2]
    service = SocialService(db)
    assert [r.id for r in await service.list_reviews("open")] == [first.id, second.id]

    moderator = await _user(db, "mod", role="moderator")
    for review in (first, second):
        await service.resolve_review(review.id, moderator, ModerationDecisionRequest(decision="uphold", note="Looks right."))

    assert [r.id for r in await service.list_reviews("resolved")] == [second.id, first.id]
    assert [r.id for r in await service.list_reviews("resolved", limit=1)] == [second.id]


# --- endpoint -----------------------------------------------------------------------

@pytest_asyncio.fixture
async def api(sessions):
    async def override_get_db():
        async with sessions() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db
    clients: list[AsyncClient] = []

    async def signed_in(username: str, role: str = "user") -> AsyncClient:
        client = AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver")
        clients.append(client)
        response = await client.post("/api/v1/auth/register", json={
            "email": f"{username}@example.com", "username": username, "password": "password123",
        })
        assert response.status_code == 200, response.text
        if role != "user":
            async with sessions() as session:
                await session.execute(update(User).where(User.username == username).values(role=role))
                await session.commit()
        return client

    yield signed_in
    for client in clients:
        await client.aclose()
    app.dependency_overrides.pop(get_db, None)


async def test_regular_users_cannot_open_the_dashboard(api):
    user = await api("plainuser")
    assert (await user.get("/api/v1/moderation/reviews")).status_code == 403


async def test_admin_lists_queue_and_history_and_resolves(api, sessions):
    async with sessions() as session:
        _, _, review = await _challenged_post(session)
        await session.commit()
    admin = await api("boss", role="admin")

    queue = await admin.get("/api/v1/moderation/reviews")
    assert queue.status_code == 200, queue.text
    assert [r["id"] for r in queue.json()] == [review.id]
    assert queue.json()[0]["challenges"][0]["reason_code"] == "missing_context"

    resolved = await admin.post(f"/api/v1/moderation/reviews/{review.id}/resolve",
                                json={"decision": "remove_verdict", "note": "Not a checkable claim."})
    assert resolved.status_code == 200, resolved.text
    assert resolved.json()["challenges"][0]["status"] == "resolved"

    assert (await admin.get("/api/v1/moderation/reviews?status=open")).json() == []
    history = (await admin.get("/api/v1/moderation/reviews?status=resolved")).json()
    assert [(r["id"], r["decision"], r["moderator"]["username"]) for r in history] == [
        (review.id, "remove_verdict", "boss"),
    ]


async def test_unknown_status_is_rejected(api):
    admin = await api("boss", role="admin")
    assert (await admin.get("/api/v1/moderation/reviews?status=everything")).status_code == 422
