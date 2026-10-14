"""Auth routes: register, login, current user, profile update, logout.

Public registration may create a **customer** or an **agent**. An
**admin** account additionally requires an invite code matching the
``ADMIN_INVITE_CODE`` setting; when that setting is empty, admin
self-registration is disabled and admins are seeded via
``scripts/create_admin.py``.
"""

from __future__ import annotations

import hmac
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from app.core.config import get_settings
from app.core.rate_limit import rate_limit_auth
from app.core.security import (
    create_access_token,
    create_reset_token,
    decode_reset_token,
    hash_password,
    verify_password,
)
from app.db.mongo import USERS, NOTIFICATIONS, get_db
from app.dependencies.auth import get_current_user
from app.models.auth import (
    AuthResponse,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    ProfileUpdateRequest,
    RegisterRequest,
    ResetPasswordRequest,
    ResetPasswordResponse,
    UserOut,
)
from app.models.enums import Role
from app.services import audit
from app.utils.serialize import user_out

router = APIRouter(prefix="/auth", tags=["auth"])


def _issue_token(user: dict) -> AuthResponse:
    settings = get_settings()
    token = create_access_token(
        user_id=str(user["_id"]),
        role=user.get("role", "customer"),
        secret=settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
        expires_minutes=settings.access_token_expire_minutes,
    )
    return AuthResponse(access_token=token, token_type="bearer", user=user_out(user))


def _client_ip(request: Request) -> str | None:
    return getattr(request.state, "ip_address", None) or (
        request.client.host if request.client else None
    )


@router.post(
    "/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new account (customer/agent; admin needs invite code)",
)
async def register(
    payload: RegisterRequest,
    request: Request,
    db=Depends(get_db),
    _rate: None = Depends(rate_limit_auth),
) -> AuthResponse:
    role = payload.role.value  # "customer" | "agent" | "admin"

    if payload.role == Role.admin:
        configured = get_settings().admin_invite_code.strip()
        if not configured:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Admin registration is not enabled. Ask an "
                    "administrator to create the account."
                ),
            )
        supplied = (payload.invite_code or "").strip()
        if not supplied or not hmac.compare_digest(supplied, configured):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid admin invite code.",
            )

    existing = await db[USERS].find_one({"email": payload.email})
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    now = datetime.now(timezone.utc)
    doc = {
        "name": payload.name,
        "email": payload.email,  # already normalized/lowered by the model
        "password_hash": hash_password(payload.password),
        "role": role,  # validated above; defaults to "customer"
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }
    try:
        result = await db[USERS].insert_one(doc)
    except Exception:  # unique index race between check + insert
        existing = await db[USERS].find_one({"email": payload.email})
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists.",
            )
        raise
    doc["_id"] = result.inserted_id

    await audit.record(
        db,
        action=audit.ACTION_REGISTER,
        actor_id=str(result.inserted_id),
        entity_type="user",
        entity_id=str(result.inserted_id),
        details=f"Registered as {role}",
        ip_address=_client_ip(request),
    )
    return _issue_token(doc)


@router.post(
    "/login",
    response_model=AuthResponse,
    summary="Exchange credentials for an access token",
)
async def login(
    payload: LoginRequest,
    request: Request,
    db=Depends(get_db),
    _rate: None = Depends(rate_limit_auth),
) -> AuthResponse:
    user = await db[USERS].find_one({"email": payload.email})
    # Constant-ish response for unknown email vs bad password.
    if user is None or not verify_password(payload.password, user.get("password_hash", "")):
        await audit.record(
            db,
            action=audit.ACTION_LOGIN_FAILED,
            entity_type="user",
            entity_id=str(user["_id"]) if user else None,
            details=f"Failed login for {payload.email}",
            ip_address=_client_ip(request),
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )
    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Contact an administrator.",
        )

    await audit.record(
        db,
        action=audit.ACTION_LOGIN,
        actor_id=str(user["_id"]),
        entity_type="user",
        entity_id=str(user["_id"]),
        details="Login succeeded",
        ip_address=_client_ip(request),
    )
    return _issue_token(user)


@router.post(
    "/forgot-password",
    response_model=ForgotPasswordResponse,
    summary="Request a password-reset token (sent as an in-app notification)",
)
async def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    db=Depends(get_db),
    _rate: None = Depends(rate_limit_auth),
) -> ForgotPasswordResponse:
    """If the email exists, store a short-lived reset token and notify the
    user. Always returns the same message so attackers can't enumerate users."""
    user = await db[USERS].find_one({"email": payload.email})
    if user is not None:
        token = create_reset_token(
            user_id=str(user["_id"]),
            email=user["email"],
            secret=get_settings().jwt_secret,
            expires_minutes=60,
        )
        now = datetime.now(timezone.utc)
        await db[USERS].update_one(
            {"_id": user["_id"]},
            {
                "$set": {
                    "password_reset_token": token,
                    "password_reset_sent_at": now,
                },
                "$unset": {"password_reset_used": 1},
            },
        )
        # Notify the user via the notifications collection rather than
        # requiring a real SMTP server in local development.
        await db[NOTIFICATIONS].insert_one(
            {
                "user_id": user["_id"],
                "type": "password_reset",
                "title": "Password reset requested",
                "message": "Click the link in the reset email to choose a new password. The link expires in 60 minutes.",
                "is_read": False,
                "data": {"reset_token": token},
                "created_at": now,
            }
        )
    # Constant response whether the email exists or not.
    return ForgotPasswordResponse()


@router.post(
    "/reset-password",
    response_model=ResetPasswordResponse,
    summary="Use a reset token to set a new password",
)
async def reset_password(
    payload: ResetPasswordRequest,
    request: Request,
    db=Depends(get_db),
) -> ResetPasswordResponse:
    """Validate the reset token and, if it is still valid and unused,
    update the password and invalidate the token."""
    try:
        decoded = decode_reset_token(
            payload.token,
            secret=get_settings().jwt_secret,
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset link. Request a new one.",
        )

    user = await db[USERS].find_one({
        "_id": decoded["sub"],
        "email": decoded["email"],
        "password_reset_token": payload.token,
    })
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset link. Request a new one.",
        )

    # Mark the token as used so it cannot be reused.
    await db[USERS].update_one(
        {"_id": user["_id"]},
        {
            "$set": {"password_reset_used": True},
            "$unset": {
                "password_reset_token": 1,
                "password_reset_sent_at": 1,
            },
        },
    )

    now = datetime.now(timezone.utc)
    await db[USERS].update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "password_hash": hash_password(payload.password),
                "updated_at": now,
            }
        },
    )

    await audit.record(
        db,
        action="password_reset",
        actor_id=str(user["_id"]),
        entity_type="user",
        entity_id=str(user["_id"]),
        details=f"Password reset for {user['email']}",
        ip_address=getattr(request.state, "ip_address", None),
    )
    return ResetPasswordResponse()


@router.post(
    "/change-password",
    response_model=ResetPasswordResponse,
    summary="Change your own password (authenticated users only)",
)
async def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
) -> ResetPasswordResponse:
    """Authenticated users can change their own password without a reset
    token. The current password is verified first."""
    if not verify_password(payload.current_password, user.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect.",
        )
    now = datetime.now(timezone.utc)
    await db[USERS].update_one(
        {"_id": user["_id"]},
        {"$set": {"password_hash": hash_password(payload.new_password), "updated_at": now}},
    )
    await audit.record(
        db,
        action="password_changed",
        actor_id=str(user["_id"]),
        entity_type="user",
        entity_id=str(user["_id"]),
        details="Password changed by user",
        ip_address=getattr(request.state, "ip_address", None),
    )
    return ResetPasswordResponse()


@router.get("/me", response_model=UserOut, summary="Current authenticated user")
async def me(user: dict = Depends(get_current_user)) -> dict:
    return user_out(user)


@router.patch("/me", response_model=UserOut, summary="Update own profile fields")
async def update_me(
    payload: ProfileUpdateRequest,
    request: Request,
    user: dict = Depends(get_current_user),
    db=Depends(get_db),
) -> dict:
    updates: dict = {}
    if payload.name is not None:
        updates["name"] = payload.name
    if payload.email is not None and payload.email != user.get("email"):
        clash = await db[USERS].find_one(
            {"email": payload.email, "_id": {"$ne": user["_id"]}}
        )
        if clash is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists.",
            )
        updates["email"] = payload.email

    if updates:
        updates["updated_at"] = datetime.now(timezone.utc)
        await db[USERS].update_one({"_id": user["_id"]}, {"$set": updates})
        user = {**user, **updates}
        await audit.record(
            db,
            action=audit.ACTION_PROFILE_UPDATED,
            actor_id=str(user["_id"]),
            entity_type="user",
            entity_id=str(user["_id"]),
            details=f"Updated: {', '.join(updates.keys())}",
            ip_address=getattr(request.state, "ip_address", None),
        )
    return user_out(user)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Logout (client discards the stateless token)",
)
async def logout(response: Response) -> Response:
    """JWTs are stateless — the client deletes its token on logout.

    There is no server-side session to invalidate; token lifetime is
    bounded by ACCESS_TOKEN_EXPIRE_MINUTES.
    """
    response.status_code = status.HTTP_204_NO_CONTENT
    return response
