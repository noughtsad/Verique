"""
Thin client for decision models (Jev, Laya) served through Vercel AI Gateway.

A decision model takes a text "state" plus typed questions and returns a
probability or choice per question, not generated text. Callers must treat
every failure as "no answer" and fall back to their existing LLM path.
"""
from dataclasses import dataclass, field
from typing import Any, Dict, Optional

import httpx
import structlog

from app.core.config import settings

logger = structlog.get_logger()


class JevError(Exception):
    """Raised when the decision API is unavailable, disabled or returns junk."""


@dataclass
class JevResult:
    """Parsed response of a systemone call."""
    answers: Dict[str, Dict[str, Any]]
    model: str = ""
    input_tokens: int = 0
    cost: Optional[float] = None
    fallback_triggered: bool = False
    raw: Dict[str, Any] = field(default_factory=dict, repr=False)

    def noul(self, question_id: str) -> Optional[float]:
        """P(true) for a yes/no question, or None if missing."""
        value = self.answers.get(question_id, {}).get("noul")
        return float(value) if value is not None else None


def noul_question(instructions: str) -> Dict[str, Any]:
    """Yes/no question answered with a probability from 0 to 1."""
    return {"type": "noul", "instructions": instructions}


def choice_question(instructions: str, criteria: Dict[str, str]) -> Dict[str, Any]:
    """Pick one option; criteria maps option name -> description."""
    return {"type": "choice", "instructions": instructions, "criteria": criteria}


def score_question(instructions: str, criteria: list) -> Dict[str, Any]:
    """Rate on an ordered scale; criteria is the ordered list of levels."""
    return {"type": "score", "instructions": instructions, "criteria": criteria}


class JevClient:
    """Async client for POST {base}/v1/systemone (Vercel AI Gateway) or the same path on
    OpenCode Zen (base https://opencode.ai/zen, model jev-1.13-free, no key)."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        timeout: Optional[float] = None,
    ):
        self.base_url = (base_url or settings.AI_GATEWAY_BASE_URL).rstrip("/")
        # AI_GATEWAY_API_KEY belongs to Vercel only; never send it to another provider.
        # JEV_API_KEY is for any other provider that needs one (OpenCode Zen's free
        # Jev model needs none).
        gateway_key = settings.AI_GATEWAY_API_KEY if "vercel.sh" in self.base_url else None
        self.api_key = api_key or settings.JEV_API_KEY or gateway_key
        self.model = model or settings.JEV_MODEL
        self.timeout = timeout or settings.JEV_TIMEOUT_SECONDS

    async def decide(
        self,
        state: str,
        questions: Dict[str, Dict[str, Any]],
        model: Optional[str] = None,
    ) -> JevResult:
        """Ask typed questions about `state`. Raises JevError on any failure."""
        if not questions:
            raise JevError("no questions given")

        headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}
        body = {"model": model or self.model, "state": state, "questions": questions}
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/v1/systemone",
                    headers=headers,
                    json=body,
                )
                response.raise_for_status()
                data = response.json()
        except httpx.HTTPStatusError as exc:
            # 429 = free-tier rate limit; surface it so callers can fall back
            logger.warning(
                "Decision API HTTP error",
                status=exc.response.status_code,
                body=exc.response.text[:200],
            )
            raise JevError(f"HTTP {exc.response.status_code}") from exc
        except (httpx.HTTPError, ValueError) as exc:
            logger.warning("Decision API call failed", error=str(exc))
            raise JevError(str(exc)) from exc

        answers = data.get("answers")
        if not isinstance(answers, dict):
            raise JevError("response has no 'answers'")

        gateway = (data.get("provider_metadata") or {}).get("gateway") or {}
        cost = gateway.get("cost")
        answered_by = data.get("model", body["model"])
        return JevResult(
            answers=answers,
            model=answered_by,
            input_tokens=int((data.get("usage") or {}).get("input_tokens", 0)),
            cost=float(cost) if cost is not None else None,
            fallback_triggered=answered_by != body["model"],
            raw=data,
        )


def jev_enabled() -> bool:
    """True when the feature flag is on. A missing key just makes calls fail soft."""
    return settings.JEV_ENABLED
