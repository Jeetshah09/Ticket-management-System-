"""Authentication and role-authorization dependencies.

Every protected endpoint depends on ``get_current_user`` (JWT bearer
token -> user document) and, where needed, ``require_agent`` /
``require_admin``. Authorization is always enforced server-side.
"""

from __future__ import annotations

from typing import Callable

import jwt
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings
from app.core.security import decode_access_token
from app.db.mongo import USERS, get_db
from app.models.enums import Role

bearer_scheme = HTTPBearer(auto_error=False)


def _unauthorized(detail: str = "Not authenticated.") -> HTTPException:
    return HTTPException(
        status_code=401,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db=Depends(get_db),
) -> dict:
    """Resolve the Authorization: Bearer <jwt> header to a user document.

    Raises 401 for missing/invalid/expired tokens and 403 for deactivated
    accounts. The full user document (including password_hash) is fetched
    here but response models never serialize it.
    """
    if credentials is None or not credentials.credentials:
        raise _unauthorized("Not authenticated. Please sign in.")

    settings = get_settings()
    try:
        payload = decode_access_token(
            credentials.credentials,
            secret=settings.jwt_secret,
            algorithm=settings.jwt_algorithm,
        )
    except jwt.ExpiredSignatureError:
        raise _unauthorized("Your session has expired. Please sign in again.")
    except jwt.PyJWTError:
        raise _unauthorized("Your session is not valid. Please sign in again.")

    try:
        user_oid = ObjectId(payload["sub"])
    except (InvalidId, TypeError):
        raise _unauthorized("Your session is not valid. Please sign in again.")

    user = await db[USERS].find_one({"_id": user_oid})
    if user is None:
        raise _unauthorized("Your account no longer exists.")
    if not user.get("is_active", True):
        raise HTTPException(
            status_code=403,
            detail="Your account has been deactivated. Contact an administrator.",
        )

    # Expose the client address for audit logging downstream.
    request.state.ip_address = request.client.host if request.client else None
    return user


def current_user_id(user: dict = Depends(get_current_user)) -> str:
    """Convenience dependency: the authenticated user's hex id."""
    return str(user["_id"])


def require_roles(*roles: Role) -> Callable:
    """Factory for dependencies that allow only specific roles (403 otherwise)."""

    allowed = set(roles)

    async def checker(user: dict = Depends(get_current_user)) -> dict:
        if Role(user.get("role", Role.customer)) not in allowed:
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to perform this action.",
            )
        return user

    return checker


# Common role gates.
require_agent = require_roles(Role.agent, Role.admin)
require_admin = require_roles(Role.admin)
