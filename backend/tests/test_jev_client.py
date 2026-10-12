"""Tests for the decision-model (Jev) client."""
import httpx
import pytest

from app.core.jev_client import JevClient, JevError, noul_question


class _Resp:
    def __init__(self, data, status=200):
        self._data, self.status_code, self.text = data, status, str(data)

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError(
                "err", request=httpx.Request("POST", "http://x"), response=self
            )

    def json(self):
        return self._data


def _patch(monkeypatch, resp, captured=None):
    async def fake_post(self, url, **kwargs):
        if captured is not None:
            captured.update(url=url, **kwargs)
        if isinstance(resp, Exception):
            raise resp
        return resp

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)


def _client():
    return JevClient(api_key="k", base_url="https://gw.test/typesafe/", model="typesafe-ai/jev")


async def test_decide_parses_answers_and_sends_request(monkeypatch):
    captured = {}
    _patch(monkeypatch, _Resp({
        "model": "typesafe-ai/jev",
        "answers": {"v": {"type": "noul", "noul": 0.93}},
        "usage": {"input_tokens": 120, "output_tokens": 5},
        "provider_metadata": {"gateway": {"cost": "0.00001"}},
    }), captured)

    result = await _client().decide("a claim", {"v": noul_question("Is it checkable?")})

    assert result.noul("v") == pytest.approx(0.93)
    assert result.input_tokens == 120
    assert result.cost == pytest.approx(0.00001)
    assert not result.fallback_triggered
    assert captured["url"] == "https://gw.test/typesafe/v1/systemone"
    assert captured["headers"]["Authorization"] == "Bearer k"
    assert captured["json"]["model"] == "typesafe-ai/jev"
    assert captured["json"]["state"] == "a claim"


async def test_no_key_sends_no_auth_header(monkeypatch):
    captured = {}
    _patch(monkeypatch, _Resp({"answers": {"q": {"noul": 0.4}}}), captured)
    client = JevClient(api_key=None, base_url="https://opencode.ai/zen", model="jev-1.13-free")
    client.api_key = None

    result = await client.decide("s", {"q": noul_question("?")})

    assert result.noul("q") == pytest.approx(0.4)
    assert "Authorization" not in captured["headers"]
    assert captured["url"] == "https://opencode.ai/zen/v1/systemone"


def test_vercel_key_is_never_used_for_other_providers(monkeypatch):
    monkeypatch.setattr("app.core.jev_client.settings.AI_GATEWAY_API_KEY", "vercel-secret")
    monkeypatch.setattr("app.core.jev_client.settings.JEV_API_KEY", None)

    assert JevClient(base_url="https://opencode.ai/zen").api_key is None
    assert JevClient(base_url="https://ai-gateway.vercel.sh/typesafe").api_key == "vercel-secret"


async def test_http_error_becomes_jeverror(monkeypatch):
    _patch(monkeypatch, _Resp({"message": "slow down"}, status=429))
    with pytest.raises(JevError, match="429"):
        await _client().decide("s", {"q": noul_question("?")})


async def test_timeout_becomes_jeverror(monkeypatch):
    _patch(monkeypatch, httpx.ReadTimeout("t"))
    with pytest.raises(JevError):
        await _client().decide("s", {"q": noul_question("?")})


async def test_response_without_answers_raises(monkeypatch):
    _patch(monkeypatch, _Resp({"oops": 1}))
    with pytest.raises(JevError):
        await _client().decide("s", {"q": noul_question("?")})


async def test_fallback_model_is_flagged(monkeypatch):
    _patch(monkeypatch, _Resp({"model": "openai/other", "answers": {"q": {"noul": 0.5}}}))
    result = await _client().decide("s", {"q": noul_question("?")})
    assert result.fallback_triggered
