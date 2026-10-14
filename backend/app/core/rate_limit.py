"""Best-effort in-memory rate limiting for the auth endpoints.

This protects a single uvicorn process only (no Redis or other
infrastructure). Deployments must ALSO rate-limit at the reverse
proxy — see README "Security notes". Set AUTH_RATE_LIMIT_PER_MINUTE=0
to disable (e.g. in tests).
"""

from __future__ import annotations

import time
from collections import deque

from fastapi import HTTPException, Request

from app.core.config import get_settings

WINDOW_SECONDS = 60


class SlidingWindowRateLimiter:
    """Per-key sliding window counter. Not memory-safe across processes."""

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = {}

    def check(self, key: str, limit: int) -> None:
        if limit <= 0:
            return
        now = time.monotonic()
        cutoff = now - WINDOW_SECONDS
        bucket = self._hits.setdefault(key, deque())
        while bucket and bucket[0] <= cutoff:
            bucket.popleft()
        if len(bucket) >= limit:
            raise HTTPException(
                status_code=429,
                detail="Too many attempts. Please wait a minute and try again.",
            )
        bucket.append(now)
        # Opportunistically bound memory usage.
        if len(self._hits) > 10_000:
            for stale_key in list(self._hits):
                stale = self._hits[stale_key]
                if not stale or stale[-1] <= cutoff:
                    self._hits.pop(stale_key, None)


def rate_limit_auth(request: Request) -> None:
    """Dependency for POST /auth/login and POST /auth/register."""
    settings = get_settings()
    limiter: SlidingWindowRateLimiter = getattr(
        request.app.state, "rate_limiter", None
    ) or SlidingWindowRateLimiter()
    request.app.state.rate_limiter = limiter
    ip = request.client.host if request.client else "unknown"
    limiter.check(f"auth:{ip}", settings.auth_rate_limit_per_minute)
