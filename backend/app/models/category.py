"""Category models."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.models.common import ApiModel


class CategoryCreate(ApiModel):
    name: str = Field(min_length=1, max_length=80)
    description: str | None = Field(default=None, max_length=500)
    is_active: bool = True

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Category name is required.")
        return v


class CategoryUpdate(ApiModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    description: str | None = Field(default=None, max_length=500)
    is_active: bool | None = None

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("Category name is required.")
        return v


class CategoryOut(BaseModel):
    id: str
    name: str
    description: str | None = None
    is_active: bool = True
    created_at: datetime | None = None
    updated_at: datetime | None = None
