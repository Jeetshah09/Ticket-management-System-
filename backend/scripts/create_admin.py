"""Create (or promote) the first administrator account.

There is NO public admin registration. This CLI is the documented way
to seed the first admin. The password is either prompted securely
(getpass, never echoed, asked twice) or passed via --password for
CI/scripts; it is never defaulted and never written to disk.

Usage (from the backend/ directory):

    python scripts/create_admin.py --email admin@example.com --name "Site Admin"
    python scripts/create_admin.py --email admin@example.com --name "Site Admin" --password "$ADMIN_PASSWORD"

Environment: reads MONGO_URI / MONGO_DB / JWT_SECRET from backend/.env
(the same variables the API uses).
"""

from __future__ import annotations

import argparse
import asyncio
import getpass
import sys
from datetime import datetime, timezone
from pathlib import Path

# Allow running as `python scripts/create_admin.py` from backend/.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import get_settings  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.db.mongo import USERS, connect  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create or promote an admin user.")
    parser.add_argument("--email", required=True, help="Admin email (will be lowercased).")
    parser.add_argument("--name", required=True, help="Admin display name.")
    parser.add_argument(
        "--password",
        help="Admin password. Omit to be prompted securely (recommended).",
    )
    return parser.parse_args()


def obtain_password(cli_password: str | None) -> str:
    if cli_password:
        password = cli_password
    else:
        first = getpass.getpass("Password: ")
        second = getpass.getpass("Confirm password: ")
        if first != second:
            raise SystemExit("Passwords do not match.")
        password = first

    if len(password) < 8:
        raise SystemExit("Password must be at least 8 characters long.")
    return password


async def main() -> None:
    args = parse_args()
    password = obtain_password(args.password)
    email = args.email.strip().lower()

    settings = get_settings()
    missing = settings.missing_essential()
    if missing:
        raise SystemExit(
            "Missing configuration: " + ", ".join(missing) + " (see backend/.env.example)."
        )

    client, db = await connect(settings.mongo_uri, settings.mongo_db)
    try:
        now = datetime.now(timezone.utc)
        existing = await db[USERS].find_one({"email": email})
        if existing is not None:
            # Promote the existing account to admin rather than failing.
            await db[USERS].update_one(
                {"_id": existing["_id"]},
                {"$set": {"role": "admin", "is_active": True, "updated_at": now}},
            )
            print(f"Updated existing user {email} -> role=admin.")
        else:
            await db[USERS].insert_one(
                {
                    "name": args.name.strip(),
                    "email": email,
                    "password_hash": hash_password(password),
                    "role": "admin",
                    "is_active": True,
                    "created_at": now,
                    "updated_at": now,
                }
            )
            print(f"Created admin user {email}.")

        await db["audit_logs"].insert_one(
            {
                "action": "user.created_admin",
                "actor_id": None,
                "entity_type": "user",
                "entity_id": email,
                "details": "Admin seeded via create_admin.py CLI",
                "ip_address": None,
                "created_at": now,
            }
        )
        print("You can now sign in at /docs (POST /api/v1/auth/login) or in the frontend.")
    finally:
        await client.aclose()


if __name__ == "__main__":
    asyncio.run(main())
