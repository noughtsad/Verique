"""Errors shared across the pipeline and API layers."""
import re
from typing import Optional

from fastapi import HTTPException, status


class LLMRateLimitError(Exception):
    """The LLM provider rejected a call with a rate/quota limit (HTTP 429).

    Retryable: the pipeline lets this propagate instead of recording a
    permanent "not_verifiable" verdict, so the caller can tell the user to
    try again later.
    """

    def __init__(self, message: str, retry_after_seconds: Optional[int] = None):
        super().__init__(message)
        self.retry_after_seconds = retry_after_seconds


_RETRY_IN = re.compile(r"try again in (?:(\d+)h)?(?:(\d+)m(?!s))?(?:(\d+(?:\.\d+)?)s)?", re.IGNORECASE)


def parse_retry_after(message: str) -> Optional[int]:
    """Extract Groq's "Please try again in 8m23.7s" hint as whole seconds."""
    match = _RETRY_IN.search(message or "")
    if not match or not any(match.groups()):
        return None
    hours, minutes, seconds = match.groups()
    total = int(hours or 0) * 3600 + int(minutes or 0) * 60 + float(seconds or 0)
    return max(1, int(total + 0.999))


def rate_limit_http_error(exc: LLMRateLimitError) -> HTTPException:
    """429 with a plain-string detail (the frontend shows `detail` verbatim)."""
    wait = exc.retry_after_seconds
    if wait is None:
        hint = "Please try again in a few minutes."
    elif wait < 90:
        hint = f"Please try again in about {wait} seconds."
    else:
        hint = f"Please try again in about {-(-wait // 60)} minutes."
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=f"The AI service has hit its usage limit, so this wasn't verified. {hint}",
        headers={"Retry-After": str(wait)} if wait else None,
    )
