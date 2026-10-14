"""Shared Pydantic building blocks."""

from __future__ import annotations

import math
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class ApiModel(BaseModel):
    """Base for request models: reject unknown fields so typos and
    attempted privilege fields (e.g. ``role`` on register) fail loudly."""

    model_config = ConfigDict(extra="forbid")


class Page(BaseModel, Generic[T]):
    """Canonical paginated envelope consumed by the frontend."""

    items: list[T] = []
    total: int = 0
    page: int = 1
    page_size: int = 20
    pages: int = 1


def page_envelope(items: list, total: int, page: int, page_size: int) -> dict:
    pages = max(1, math.ceil(total / page_size)) if page_size > 0 else 1
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": pages,
    }
