"""Auth tests: registration, login, hashing, token validation, profile."""

from __future__ import annotations

import jwt as pyjwt

from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


# --------------------------- password hashing ------------------------------


def test_password_hashing_roundtrip():
    digest = hash_password("S3cure-password!")
    assert digest != "S3cure-password!"
    assert verify_password("S3cure-password!", digest)
    assert not verify_password("wrong-password", digest)


def test_password_hashes_are_salted():
    a = hash_password("same-password")
    b = hash_password("same-password")
    assert a != b  # unique salt per hash


def test_verify_password_never_raises_on_garbage():
    assert not verify_password("whatever", "not-a-bcrypt-hash")
    assert not verify_password("whatever", "")


# ------------------------------ JWT tokens ---------------------------------


def test_token_roundtrip_and_claims():
    settings = get_settings()
    token = create_access_token(
        user_id="64b000000000000000000001",
        role="agent",
        secret=settings.jwt_secret,
        expires_minutes=5,
    )
    payload = decode_access_token(token, secret=settings.jwt_secret)
    assert payload["sub"] == "64b000000000000000000001"
    assert payload["role"] == "agent"
    assert payload["typ"] == "access"


def test_token_signed_with_wrong_secret_is_rejected():
    token = create_access_token(
        user_id="64b000000000000000000001", role="customer", secret="right-secret"
    )
    try:
        decode_access_token(token, secret="wrong-secret")
        raise AssertionError("expected jwt error")
    except pyjwt.PyJWTError:
        pass


def test_non_access_tokens_are_rejected():
    settings = get_settings()
    import datetime as dt

    forged = pyjwt.encode(
        {
            "sub": "64b000000000000000000001",
            "role": "admin",
            "typ": "refresh",
            "exp": dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=5),
        },
        settings.jwt_secret,
        algorithm="HS256",
    )
    try:
        decode_access_token(forged, secret=settings.jwt_secret)
        raise AssertionError("expected jwt error for non-access token")
    except pyjwt.PyJWTError:
        pass


# ---------------------------- registration ---------------------------------


def test_register_success_returns_token_and_user(client, unique_email):
    res = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Alice Customer",
            "email": unique_email("alice"),
            "password": "Password123!",
        },
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["access_token"]
    assert body["token_type"] == "bearer"
    assert body["user"]["role"] == "customer"  # registration is always customer
    assert "password" not in res.text
    assert "password_hash" not in res.text


def test_register_normalizes_email(client, unique_email):
    email = unique_email("MixedCase")
    res = client.post(
        "/api/v1/auth/register",
        json={"name": "Bob", "email": email.upper(), "password": "Password123!"},
    )
    assert res.status_code == 201, res.text
    assert res.json()["user"]["email"] == email.lower()


def test_register_duplicate_email_conflicts(client, unique_email):
    email = unique_email("dup")
    payload = {"name": "Dup", "email": email, "password": "Password123!"}
    assert client.post("/api/v1/auth/register", json=payload).status_code == 201
    res = client.post("/api/v1/auth/register", json=payload)
    assert res.status_code == 409


def test_register_rejects_short_password(client, unique_email):
    res = client.post(
        "/api/v1/auth/register",
        json={"name": "X", "email": unique_email("short"), "password": "1234567"},
    )
    assert res.status_code == 422


def test_register_rejects_invalid_email(client, unique_email):
    res = client.post(
        "/api/v1/auth/register",
        json={"name": "X", "email": "not-an-email", "password": "Password123!"},
    )
    assert res.status_code == 422


def test_register_cannot_choose_unknown_role(client, unique_email):
    res = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Sneaky",
            "email": unique_email("sneaky"),
            "password": "Password123!",
            "role": "superuser",
        },
    )
    # Not one of customer|agent|admin -> rejected by the enum.
    assert res.status_code == 422


def test_register_as_agent(client, unique_email):
    res = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Helpful Agent",
            "email": unique_email("agent"),
            "password": "Password123!",
            "role": "agent",
        },
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["user"]["role"] == "agent"
    assert body["access_token"]


def test_register_as_admin_without_invite_code_rejected(client, unique_email):
    res = client.post(
        "/api/v1/auth/register",
        json={
            "name": "No Code",
            "email": unique_email("nocd"),
            "password": "Password123!",
            "role": "admin",
        },
    )
    assert res.status_code == 403
    # And no account was created:
    assert client.get("/api/v1/auth/me").status_code == 401


def test_register_as_admin_with_wrong_invite_code_rejected(client, unique_email):
    res = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Wrong Code",
            "email": unique_email("wrongcode"),
            "password": "Password123!",
            "role": "admin",
            "invite_code": "not-the-code",
        },
    )
    assert res.status_code == 403


def test_register_as_admin_with_invite_code(client, unique_email):
    from conftest import TEST_ADMIN_INVITE_CODE

    res = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Real Admin",
            "email": unique_email("realadmin"),
            "password": "Password123!",
            "role": "admin",
            "invite_code": TEST_ADMIN_INVITE_CODE,
        },
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["user"]["role"] == "admin"
    # The invite code never leaks into the response.
    assert "invite_code" not in res.text
    assert "password" not in res.text


# --------------------------------- login -----------------------------------


def test_login_success(client, register_user):
    account = register_user("customer")
    # Re-login with the same credentials.
    email = account.user["email"]
    res = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "Password123!"}
    )
    assert res.status_code == 200
    assert res.json()["access_token"]


def test_login_wrong_password_is_401(client, register_user, unique_email):
    account = register_user("customer")
    res = client.post(
        "/api/v1/auth/login",
        json={"email": account.user["email"], "password": "WrongPass999!"},
    )
    assert res.status_code == 401


def test_login_unknown_email_is_401_not_404(client, unique_email):
    res = client.post(
        "/api/v1/auth/login",
        json={"email": unique_email("ghost"), "password": "Password123!"},
    )
    assert res.status_code == 401


def test_deactivated_user_cannot_login(client, admin_account, register_user):
    account = register_user("customer")
    res = client.patch(
        f"/api/v1/users/{account.id}",
        json={"is_active": False},
        headers=admin_account.headers(),
    )
    assert res.status_code == 200
    res = client.post(
        "/api/v1/auth/login",
        json={"email": account.user["email"], "password": "Password123!"},
    )
    assert res.status_code == 403


# ------------------------------ token usage --------------------------------


def test_me_requires_token(client):
    assert client.get("/api/v1/auth/me").status_code == 401


def test_me_rejects_garbage_token(client):
    res = client.get(
        "/api/v1/auth/me", headers={"Authorization": "Bearer not.a.token"}
    )
    assert res.status_code == 401


def test_me_rejects_token_signed_with_other_secret(client):
    import datetime as dt

    forged = pyjwt.encode(
        {
            "sub": "64b000000000000000000001",
            "role": "admin",
            "typ": "access",
            "exp": dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=10),
        },
        "some-other-secret",
        algorithm="HS256",
    )
    res = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {forged}"})
    assert res.status_code == 401


def test_me_returns_profile(client, register_user):
    account = register_user("customer")
    res = client.get("/api/v1/auth/me", headers=account.headers())
    assert res.status_code == 200
    body = res.json()
    assert body["id"] == account.id
    assert body["email"] == account.user["email"]


def test_update_profile_name(client, register_user):
    account = register_user("customer")
    res = client.patch(
        "/api/v1/auth/me",
        json={"name": "Renamed Person"},
        headers=account.headers(),
    )
    assert res.status_code == 200
    assert res.json()["name"] == "Renamed Person"


def test_update_profile_rejects_role_field(client, register_user):
    account = register_user("customer")
    res = client.patch(
        "/api/v1/auth/me",
        json={"role": "admin"},
        headers=account.headers(),
    )
    assert res.status_code == 422


def test_logout_is_supported_and_stateless(client, register_user):
    account = register_user("customer")
    res = client.post("/api/v1/auth/logout", headers=account.headers())
    assert res.status_code == 204
