"""Shared pytest fixtures.

Tests run against a REAL MongoDB but a DEDICATED test database
(``ticket_management_db_test``) so the developer's normal database is
never touched. The test DB is dropped at session start and end.

Environment variables are set BEFORE the app is imported so the
module-level ``get_settings()`` cache sees the same configuration the
app factory uses (token signing and verification must agree).

If MongoDB is unreachable the entire suite is skipped with a clear
message (external services stay optional, per the master prompt).
"""

from __future__ import annotations

import os
import uuid

import pytest

TEST_DB_NAME = "ticket_management_db_test"
TEST_JWT_SECRET = "test-secret-not-for-production-use-only-0123456789abcdef"
TEST_ADMIN_INVITE_CODE = "test-admin-invite-code-0123456789"
MONGO_URI = os.environ.get("MONGO_URI", "mongodb://127.0.0.1:27017")


def _mongo_reachable() -> bool:
    try:
        from pymongo import MongoClient

        client = MongoClient(
            MONGO_URI, serverSelectionTimeoutMS=1500, connectTimeoutMS=1500
        )
        client.admin.command("ping")
        client.close()
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(
    not _mongo_reachable(),
    reason="MongoDB is not reachable — start mongod or set MONGO_URI to run the suite.",
)


@pytest.fixture(scope="session")
def app():
    """Build the real application pointed at the isolated test database."""
    os.environ["MONGO_URI"] = MONGO_URI
    os.environ["MONGO_DB"] = TEST_DB_NAME
    os.environ["JWT_SECRET"] = TEST_JWT_SECRET
    os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "60"
    os.environ["AUTH_RATE_LIMIT_PER_MINUTE"] = "0"  # disable limiter in tests
    os.environ["CORS_ORIGINS"] = "http://localhost:3000"
    # Enables admin self-registration so the invite-code flow is testable.
    os.environ["ADMIN_INVITE_CODE"] = TEST_ADMIN_INVITE_CODE

    from app.core.config import get_settings

    get_settings.cache_clear()

    from app.main import create_app

    return create_app()


@pytest.fixture(scope="session")
def client(app):
    from fastapi.testclient import TestClient
    from pymongo import MongoClient

    bootstrap = MongoClient(MONGO_URI)
    bootstrap.drop_database(TEST_DB_NAME)
    bootstrap.close()

    with TestClient(app) as test_client:
        yield test_client

    bootstrap = MongoClient(MONGO_URI)
    bootstrap.drop_database(TEST_DB_NAME)
    bootstrap.close()


@pytest.fixture(scope="session")
def unique_email():
    """Factory for fresh, collision-free emails per test."""

    def _make(prefix: str = "user") -> str:
        return f"{prefix}-{uuid.uuid4().hex[:10]}@example.com"

    return _make


class Account:
    """Convenience wrapper: holds a user's token + profile."""

    def __init__(self, token: str, user: dict):
        self.token = token
        self.user = user
        self.id = user["id"]
        self.role = user["role"]

    def headers(self) -> dict:
        return {"Authorization": f"Bearer {self.token}"}


def _register_via_api(client, email: str, name: str, password: str) -> Account:
    res = client.post(
        "/api/v1/auth/register",
        json={"name": name, "email": email, "password": password},
    )
    assert res.status_code == 201, res.text
    data = res.json()
    return Account(data["access_token"], data["user"])


def _promote_in_db(user_id: str, role: str | None = None, is_active: bool | None = None):
    """Promote/deactivate a user directly in the test DB — the fast path
    for fixtures (production offers scripts/create_admin.py plus the
    ADMIN_INVITE_CODE self-registration flow)."""
    from bson import ObjectId
    from pymongo import MongoClient

    update: dict = {}
    if role is not None:
        update["role"] = role
    if is_active is not None:
        update["is_active"] = is_active

    mongo = MongoClient(MONGO_URI)
    mongo[TEST_DB_NAME].users.update_one(
        {"_id": ObjectId(user_id)}, {"$set": update}
    )
    mongo.close()


@pytest.fixture
def register_user(client, unique_email):
    """Register a user of any role via the real public API.

    Non-customer roles are promoted directly in the test database and
    then re-login so the JWT carries the new role.
    """

    def _register(role: str = "customer", *, password: str = "Password123!") -> Account:
        email = unique_email(role)
        account = _register_via_api(client, email, f"Test {role}", password)
        if role != "customer":
            _promote_in_db(account.id, role=role)
            account = _relogin(client, email, password)
        return account

    return _register


def _relogin(client, email: str, password: str) -> Account:
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    data = res.json()
    return Account(data["access_token"], data["user"])


@pytest.fixture
def admin_account(client, unique_email):
    """A fresh admin per test (avoids shared-state surprises)."""
    email = unique_email("admin")
    account = _register_via_api(client, email, "Admin", "Password123!")
    _promote_in_db(account.id, role="admin")
    return _relogin(client, email, "Password123!")


@pytest.fixture
def category(client, admin_account):
    """Create a fresh active category (admin) and return the full object."""
    name = f"Category {uuid.uuid4().hex[:8]}"
    res = client.post(
        "/api/v1/categories",
        json={"name": name, "description": "Test category", "is_active": True},
        headers=admin_account.headers(),
    )
    assert res.status_code == 201, res.text
    return res.json()
