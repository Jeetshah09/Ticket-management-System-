# Backend Guide

Code-level guide to `backend/`. Setup commands: [SETUP_GUIDE.md](SETUP_GUIDE.md) ·
request flow: [ARCHITECTURE.md](ARCHITECTURE.md).

Stack: **FastAPI** (Python 3.11+) · **Uvicorn** · **Pydantic v2** +
pydantic-settings · **PyMongo async API** (no ORM, no Motor) · **PyJWT** + **bcrypt**
· **pytest**.

## Layout

```
backend/
├── app/
│   ├── main.py                 # create_app() factory, lifespan, CORS, error handlers
│   ├── api/v1/                 # routers (HTTP layer)
│   │   ├── __init__.py         # api_router: aggregates all domain routers
│   │   ├── auth.py  users.py  tickets.py  categories.py
│   │   ├── notifications.py  analytics.py  audit_logs.py  health.py
│   ├── core/
│   │   ├── config.py           # Settings (pydantic-settings), fail-fast checks
│   │   ├── security.py         # bcrypt hash/verify, JWT create/decode
│   │   ├── errors.py           # centralized exception handlers (no leaks)
│   │   └── rate_limit.py       # in-memory sliding window for auth routes
│   ├── db/mongo.py             # client lifecycle, index init, get_db dependency
│   ├── dependencies/auth.py    # get_current_user, require_roles/agent/admin
│   ├── models/                 # Pydantic schemas + enums (contract)
│   │   ├── enums.py            # Role/TicketStatus/TicketPriority/…, ALLOWED_TRANSITIONS
│   │   ├── common.py           # ApiModel (extra=forbid), Page envelope
│   │   └── auth.py ticket.py category.py notification.py admin.py
│   ├── services/               # business logic (no HTTP concerns)
│   │   ├── tickets.py          # visibility, lifecycle, transitions, conversation
│   │   ├── analytics.py        # role-scoped aggregations
│   │   ├── audit.py  notifications.py
│   └── utils/serialize.py      # Mongo doc → response dict (ObjectId → hex string)
├── scripts/create_admin.py     # first-admin seeding CLI
├── tests/                      # pytest suite (conftest + 5 modules, 96 tests)
├── .env.example  pytest.ini  requirements.txt  README.md
```

## Layering rules

1. **Routers** (`app/api/v1/`) declare path/query/body models, call a service, and
   choose status codes. They hold **no** business rules. Response models are declared
   so the OpenAPI schema is accurate.
2. **Services** (`app/services/`) implement the rules and are callable without HTTP:
   ticket visibility and the status state machine (`tickets.py`), aggregates
   (`analytics.py`), side effects (`audit.py`, `notifications.py`).
3. **Models** (`app/models/`) are the contract: request models forbid unknown fields
   (`ApiModel`, `extra="forbid"`) so a smuggled `role` or `is_active` in a body is a
   422, not a silent ignore. Enums live once in `enums.py`.
4. **Serialization** (`app/utils/serialize.py`) is the only place documents become
   response dicts; ids become lowercase hex strings, `password_hash` is never touched.
5. There is **no repository layer** — services use the shared async collection
   handles. Adding one would be indirection without a second persistence target.

## Request lifecycle

```
request → CORS middleware → router
        → dependencies: rate_limit (auth routes) → get_current_user (JWT→user doc)
        → Pydantic validation (422 with loc arrays)
        → service call (business rules; may raise HTTPException 400/403/404/409)
        → serialize → JSON response
errors → app/core/errors.py handlers (unexpected → 500 generic + server-side log)
```

## Key mechanisms worth knowing

- **App factory**: `create_app(settings=None)` in `main.py`. Tests call it with a
  custom `Settings` for an isolated database; `uvicorn app.main:app` uses the module-
  level instance with env-derived settings.
- **Lifespan** (startup/shutdown): validates `JWT_SECRET` (fail fast), connects +
  pings MongoDB (fail fast with the URI in the message), builds indexes, creates the
  rate limiter; shutdown closes the client.
- **Auth dependency**: `get_current_user` re-fetches the user document on **every**
  request, so role/deactivation changes apply immediately — the JWT's embedded role
  is advisory only.
- **Object visibility**: `get_ticket_or_404` answers 404 for both "doesn't exist" and
  "exists but not yours" — existence is never leaked.
- **Status machine**: `ALLOWED_TRANSITIONS` in `models/enums.py`;
  `_validate_transition` in `services/tickets.py` → 400 on illegal jumps.
- **Async PyMongo notes** (4.11 vs 4.12+): `find()` returns a cursor directly
  (`await cursor.to_list(...)`), while `aggregate()` returns a coroutine that must be
  awaited first (`cursor = await coll.aggregate(...)`). `AsyncDatabase` is imported
  from `pymongo` when available, falling back to `pymongo.asynchronous.database`
  (4.11). See `db/mongo.py`.
- **Side effects are best-effort**: audit/notification inserts are wrapped so a
  failure logs a warning instead of failing the user's request.

## Configuration

`app/core/config.py::Settings` (env vars documented in
[ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md)); `get_settings()` is an
`lru_cache` singleton. `missing_essential()` drives the fail-fast startup check.

## Error handling contract

- Raise `HTTPException(status_code, detail="…")` for anything a client can act on.
- The global handler in `core/errors.py` catches unlogged exceptions →
  `{"detail": "Internal server error."}` with a **500**, full traceback only in
  server logs. Clients never see stack traces, paths, or credentials.
- 422 bodies are FastAPI's validation array (`loc` = `["body"|"query", field]`),
  which the frontend maps to field errors.

## Testing conventions

- `tests/conftest.py` sets environment variables **before** importing the app and
  clears the settings cache, so token signing and verification use the same secret.
- Fixtures: `client` (TestClient with lifespan), `register_user("customer"|"agent")`,
  `admin_account`, `category`, `unique_email`. Agents/admins are created by
  registering a customer and promoting the account **directly in the test database**
  (mirrors the production CLI; there is no public staff signup).
- The suite uses `ticket_management_db_test` and drops it at session end; if MongoDB
  is unreachable the whole suite **skips** with a clear reason.
- Run: `python -m pytest` from `backend/` (details [TESTING.md](TESTING.md)).

## Conventions for new code

1. Enum/values change? Update `models/enums.py` **and** `frontend/types/` +
   `frontend/lib/constants.ts` in the same change.
2. New endpoint: router method + request/response models + service function + tests
   (happy path, permission denial, validation) — and it appears in OpenAPI
   automatically.
3. Never serialize `password_hash`; never log tokens, passwords, or message bodies.
4. Authorization in dependencies/services, not in frontend-visible conditionals.
5. Keep bodies `extra=forbid` (via `ApiModel`) so unknown fields fail loudly.
6. No new infrastructure (Redis, queues) without an explicit requirement.
