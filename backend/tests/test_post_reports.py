"""
Integration tests for POST /posts/{id}/report.
"""
from httpx import AsyncClient


async def _register(client: AsyncClient, *, email: str, username: str) -> None:
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "username": username,
            "full_name": username.capitalize(),
            "password": "password123",
        },
    )
    assert response.status_code == 200, response.text


async def _author_with_post(client_factory):
    author = client_factory()
    reporter = client_factory()
    await _register(author, email="author@example.com", username="author")
    await _register(reporter, email="reporter@example.com", username="reporter")
    post = await author.post("/api/v1/posts/", json={"content": "A post that someone will report."})
    assert post.status_code == 200
    return author, reporter, post.json()["id"]


async def test_report_post_succeeds(client_factory):
    _, reporter, post_id = await _author_with_post(client_factory)

    resp = await reporter.post(
        f"/api/v1/posts/{post_id}/report",
        json={"reason_code": "misinformation", "details": "  Claims a fake statistic.  "},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["post_id"] == post_id
    assert body["reason_code"] == "misinformation"
    assert body["status"] == "open"


async def test_report_post_twice_is_conflict(client_factory):
    _, reporter, post_id = await _author_with_post(client_factory)

    first = await reporter.post(f"/api/v1/posts/{post_id}/report", json={"reason_code": "spam"})
    assert first.status_code == 201
    second = await reporter.post(f"/api/v1/posts/{post_id}/report", json={"reason_code": "scam"})
    assert second.status_code == 409


async def test_cannot_report_own_post(client_factory):
    author, _, post_id = await _author_with_post(client_factory)

    resp = await author.post(f"/api/v1/posts/{post_id}/report", json={"reason_code": "spam"})
    assert resp.status_code == 400


async def test_report_unknown_post_is_404(client_factory):
    _, reporter, _ = await _author_with_post(client_factory)

    resp = await reporter.post("/api/v1/posts/9999/report", json={"reason_code": "spam"})
    assert resp.status_code == 404


async def test_report_rejects_unknown_reason(client_factory):
    _, reporter, post_id = await _author_with_post(client_factory)

    resp = await reporter.post(f"/api/v1/posts/{post_id}/report", json={"reason_code": "because"})
    assert resp.status_code == 422


async def test_report_requires_login(client_factory):
    _, _, post_id = await _author_with_post(client_factory)
    anonymous = client_factory()

    resp = await anonymous.post(f"/api/v1/posts/{post_id}/report", json={"reason_code": "spam"})
    assert resp.status_code == 401
