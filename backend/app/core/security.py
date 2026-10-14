"""Password hashing and JWT access tokens."""

from __future__ import annotations

import datetime as dt

import bcrypt
import jwt

BCRYPT_ROUNDS = 12


def hash_password(password: str) -> str:
    """Hash a password with bcrypt (salt included in the digest)."""
    salt = bcrypt.gensalt(rounds=BCRYPT_ROUNDS)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Constant-time-ish password check; never raises on malformed hashes."""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(
    *,
    user_id: str,
    role: str,
    secret: str,
    algorithm: str = "HS256",
    expires_minutes: int = 720,
) -> str:
    """Create a signed, expiring access token.

    The token is stateless: logout is performed client-side by discarding
    it (see README "Authentication & sessions").
    """
    now = dt.datetime.now(dt.timezone.utc)
    payload = {
        "sub": user_id,
        "role": role,
        "iat": now,
        "exp": now + dt.timedelta(minutes=expires_minutes),
        "typ": "access",
    }
    return jwt.encode(payload, secret, algorithm=algorithm)


def decode_access_token(token: str, *, secret: str, algorithm: str = "HS256") -> dict:
    """Decode/validate a token. Raises jwt.PyJWTError on any failure."""
    payload = jwt.decode(token, secret, algorithms=[algorithm])
    if payload.get("typ") != "access" or not payload.get("sub"):
        raise jwt.InvalidTokenError("Unsupported token")
    return payload


def create_reset_token(*, user_id: str, email: str, secret: str, algorithm: str = "HS256", expires_minutes: int = 60) -> str:
    """Create a signed, short-lived password-reset token.

    The token embeds the user id and email so the reset endpoint can
    verify they still match before allowing the password change.
    """
    now = dt.datetime.now(dt.timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "typ": "reset",
        "iat": now,
        "exp": now + dt.timedelta(minutes=expires_minutes),
    }
    return jwt.encode(payload, secret, algorithm=algorithm)


def decode_reset_token(token: str, *, secret: str, algorithm: str = "HS256") -> dict:
    """Decode/validate a reset token. Raises jwt.PyJWTError on failure."""
    payload = jwt.decode(token, secret, algorithms=[algorithm])
    if payload.get("typ") != "reset" or not payload.get("sub") or not payload.get("email"):
        raise jwt.InvalidTokenError("Unsupported reset token")
    return payload
