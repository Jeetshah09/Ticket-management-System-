"""Auth request/response models."""

from __future__ import annotations

from datetime import datetime

from pydantic import EmailStr, Field, field_validator

from app.models.common import ApiModel
from app.models.enums import Role

class RegisterRequest(ApiModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    role: Role = Role.customer
    invite_code: str | None = Field(default=None, max_length=200)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name is required.")
        return v

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class LoginRequest(ApiModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=72)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class ProfileUpdateRequest(ApiModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    email: EmailStr | None = None

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("Name is required.")
        return v

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str | None) -> str | None:
        return v.strip().lower() if v else v


class ForgotPasswordRequest(ApiModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class ResetPasswordRequest(ApiModel):
    token: str = Field(min_length=1, max_length=500)
    password: str = Field(min_length=8, max_length=72)


class ChangePasswordRequest(ApiModel):
    current_password: str = Field(min_length=1, max_length=72)
    new_password: str = Field(min_length=8, max_length=72)


# ------------------------------- responses --------------------------------

from pydantic import BaseModel  # noqa: E402


class UserSummaryOut(BaseModel):
    id: str
    name: str
    email: str
    role: Role


class UserOut(UserSummaryOut):
    is_active: bool = True
    created_at: datetime | None = None
    updated_at: datetime | None = None


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut | None = None


class ForgotPasswordResponse(BaseModel):
    message: str = "If that email exists, a reset link has been sent."


class ResetPasswordResponse(BaseModel):
    message: str = "Your password has been reset. You can now sign in."
