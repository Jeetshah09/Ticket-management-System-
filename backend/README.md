# Ticket Management System — Backend

FastAPI + MongoDB API for the Ticket Management System. Three roles
(**customer**, **agent**, **admin**), JWT auth, role-scoped ticket
workflow, in-app notifications, analytics and admin audit logs.

* Interactive API docs: `http://localhost:8000/docs`
* OpenAPI schema: `http://localhost:8000/openapi.json`
* Health probe: `GET /api/v1/health`
* Full project documentation (API reference, database, security, testing…):
  [`../docs/`](../docs/README.md) — key pages:
  [API_DOCUMENTATION.md](../docs/API_DOCUMENTATION.md),
  [BACKEND_GUIDE.md](../docs/BACKEND_GUIDE.md),
  [DATABASE.md](../docs/DATABASE.md),
  [SECURITY.md](../docs/SECURITY.md)

---

## 1. Requirements

* Python **3.11+**
* MongoDB **6+** running locally (or a connection string to a remote
  instance)

## 2. Windows PowerShell setup

```powershell
cd backend

# 1. Virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# 2. Dependencies
python -m pip install -r requirements.txt

# 3. Configuration
Copy-Item .env.example .env
# Open .env and set a real JWT_SECRET, e.g.:
#   python -c "import secrets; print(secrets.token_urlsafe(48))"
# The server REFUSES to start while JWT_SECRET is missing or still the
# placeholder value from .env.example (fail-fast startup check).

# 4. Make sure MongoDB is running, e.g.:
#    mongod --dbpath C:\data\db
```

## 3. Environment variables (`backend/.env`)

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `MONGO_URI` | no | `mongodb://127.0.0.1:27017` | MongoDB connection string |
| `MONGO_DB` | no | `ticket_management_db` | Database name |
| `JWT_SECRET` | **yes** | — | HS256 signing secret; startup fails without it |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | no | `720` | Access-token lifetime |
| `CORS_ORIGINS` | no | `http://localhost:3000,http://localhost:5173` | Comma-separated allowed origins |
| `AUTH_RATE_LIMIT_PER_MINUTE` | no | `10` | In-memory limiter for `/auth/login` + `/auth/register` per IP; `0` disables |

`.env.example` contains placeholders only — never put real secrets in
it or commit `.env` (see `.gitignore`).

## 4. Database setup & indexes

No manual migration step is needed: on startup the app pings MongoDB
(fail-fast with a clear error if unreachable) and creates all indexes
**idempotently** (`create_index` is safe to run repeatedly). Indexes:
unique `users.email`, unique `tickets.ticket_number`, requester/
assignee/status/priority/category/timestamp lookups, message
chronological order, notification read-state, audit-log queries.

Collections: `users`, `tickets`, `ticket_messages`, `categories`,
`notifications`, `audit_logs`, `counters` (human-readable ticket
numbers).

## 5. Run

```powershell
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Open `http://localhost:8000/docs` for the interactive API explorer.

## 6. Create the first admin (CLI)

There is **no public admin registration**. Seed the first admin with:

```powershell
python scripts/create_admin.py --email admin@example.com --name "Site Admin"
# Prompts for the password (never echoed, asked twice, no default).
# For CI: --password $env:ADMIN_PASSWORD
```

Running it again with the same email promotes that account back to
admin (safe to re-run). Every seeding writes an audit-log entry.

## 7. Tests

```powershell
.\.venv\Scripts\Activate.ps1
python -m pytest
```

* Tests run against a **dedicated test database**
  (`ticket_management_db_test`) that is dropped before and after the
  run — your normal database is never touched.
* If MongoDB is unreachable the suite is **skipped** with a clear
  message instead of failing (external services stay optional).
* Coverage includes: registration/login success & failure, password
  hashing, token validation/tampering, role permissions (403s),
  customer ticket isolation (404, no existence leak), ticket
  create/list/detail/update, invalid status transitions, internal-note
  privacy (never returned to customers), assignment permissions,
  category admin permissions, notification ownership, audit-log
  admin-only access, health, and OpenAPI route integrity.

## 8. API surface (all under `/api/v1`)

| Method & path | Access | Purpose |
|---|---|---|
| `POST /auth/register` | public | Register a **customer** (role is never client-controlled) |
| `POST /auth/login` | public | Get JWT + user |
| `POST /auth/logout` | auth | Stateless logout (client discards token) |
| `GET /auth/me`, `PATCH /auth/me` | auth | Profile read/update (name, email only) |
| `GET /tickets` | auth | Role-scoped list; filters: `search`, `status`, `priority`, `category_id`, `assignee_id` (`me`/`unassigned`), `requester_id` (`me`), `sort_by`, `sort_order`, paging |
| `POST /tickets` | auth | Create ticket (requester = caller) |
| `GET /tickets/{id}` | auth | Ticket + conversation (internal notes stripped for customers) |
| `PATCH /tickets/{id}` | auth | Update fields/status (validated transitions; customers can't set status) |
| `POST /tickets/{id}/messages` | auth | Public reply or internal note (agent/admin) |
| `POST /tickets/{id}/assign` | agent/admin | Assign/unassign (agents & admins only) |
| `GET /categories` | auth | Active categories (admins: `include_inactive=1`) |
| `POST /categories`, `PATCH /categories/{id}` | admin | Create/update/activate/deactivate |
| `GET /categories/{id}/usage` | admin | Ticket reference count |
| `GET /notifications` | auth | **Own** notifications; `unread_only=1`; includes `unread_count` |
| `PATCH /notifications/{id}/read`, `POST /notifications/read-all` | auth | Mark read (ownership enforced → 404 for foreign ids) |
| `GET /analytics/overview` | auth | Role-scoped aggregate metrics |
| `GET /analytics/agents` | admin | Per-agent workload |
| `GET /users`, `GET /users/{id}`, `PATCH /users/{id}` | admin | User management (role / is_active) |
| `GET /audit-logs` | admin | Filterable by `action`, `actor_id`, `entity_type` |
| `GET /health` | public | Liveness/readiness (no sensitive diagnostics) |

## 9. Authorization model

* **customer** — creates tickets, sees/edits only **own** tickets
  (never after resolved/closed), replies publicly, cannot change
  status or assignment, cannot add internal notes.
* **agent** — sees own + assigned + unassigned (queue) tickets; can
  change status (validated state machine), assign, reply, add internal
  notes.
* **admin** — everything above plus users, categories, analytics and
  audit logs. Admins cannot deactivate or demote **their own**
  account (lockout guard).

Visibility violations answer **404** (not 403) so the API never leaks
the existence of other customers' tickets or notifications.

Status transitions (`models/enums.py`): open↔in_progress↔pending,
either → resolved → closed, closed → open (reopen). Invalid jumps
return **400**.

## 10. Authentication & sessions

* Passwords: **bcrypt** (12 rounds, per-hash salt).
* Tokens: stateless JWT (HS256) with `sub`, `role`, `iat`, `exp` and
  `typ=access`; refresh tokens are not used. Logout = client discards
  the token; lifetime is bounded by `ACCESS_TOKEN_EXPIRE_MINUTES`.
  Compromised-token revocation would require a blocklist (documented
  trade-off; not implemented to avoid extra infrastructure).
* 401 = missing/invalid/expired token; 403 = authenticated but not
  allowed (or deactivated account).

## 11. Security notes

* No secrets in source control; `.env` is gitignored, startup fails
  fast on missing/placeholder `JWT_SECRET`.
* CORS origins come from the environment, never hardcoded.
* **Rate limiting** on `/auth/login` and `/auth/register` is a
  best-effort *in-memory* sliding window (single uvicorn process
  only). Production deployments must also rate-limit at the reverse
  proxy (nginx/Cloudflare/etc.).
* Errors are normalized; stack traces, DB credentials and internal
  paths never reach clients (see `core/errors.py`).
* Audit logs record auth events, ticket lifecycle changes, assignment,
  category/user administration — never passwords, tokens or message
  bodies. Admin-only access.
* Registration is always `customer`; the role field is rejected at
  validation (`extra=forbid`). Admins are seeded only via
  `scripts/create_admin.py`.

## 12. Attachments — NOT implemented (v1)

File attachments are **intentionally out of scope** for this release.
There are **no attachment/upload endpoints** — fake stubs are not
exposed (a test asserts this). If added later, the plan is: GridFS or
local-disk blob storage + metadata documents in `attachments`, MIME
sniffing (not trusting client content type), size limits via
`python-multipart`, and ownership checks on download.

## 13. Async approach

PyMongo's built-in async API (`AsyncMongoClient`, pymongo ≥ 4.11) is
used instead of Motor — one less dependency, same driver. Notes:
`find()` returns a cursor directly (`await cursor.to_list(...)`), while
`await coll.aggregate(pipeline)` first yields the command cursor
(pymongo 4.11; top-level `AsyncDatabase` import needs pymongo ≥ 4.12 —
the code handles both).

## 14. Project structure

```
backend/
├── app/
│   ├── main.py               # App factory, lifespan, CORS, fail-fast checks
│   ├── api/v1/               # Routers: auth, users, tickets, categories,
│   │                         # notifications, analytics, audit-logs, health
│   ├── core/                 # config, security (bcrypt/JWT), errors, rate limit
│   ├── db/mongo.py           # Connection, lifecycle, index initialization
│   ├── dependencies/auth.py  # get_current_user / require_agent / require_admin
│   ├── models/               # Pydantic schemas + enums (single source of truth)
│   ├── services/             # Business logic: tickets, analytics, audit,
│   │                         # notifications
│   └── utils/                # Serialization helpers
├── scripts/create_admin.py   # First-admin seeding CLI
├── tests/                    # pytest + httpx TestClient suite (96 tests)
├── .env.example
├── pytest.ini
└── requirements.txt
```
