# DeskFlow — Ticket Management System

**DeskFlow** is a conventional support/helpdesk ticketing application: customers submit
and track tickets, support agents work a queue and reply, and administrators manage
users, categories, assignments, analytics and audit logs. It is a standard
client/server product — **there are no AI, Gemini or LLM features anywhere in the
codebase**, by design.

| | |
|---|---|
| **Implementation status** | Core v1 is **fully implemented and tested**: auth, role-based access, ticket lifecycle with a validated state machine, replies + internal notes, categories, notifications, analytics, audit logs. **Not implemented:** file attachments (no endpoints exist — see [FILE_ATTACHMENTS.md](FILE_ATTACHMENTS.md)). |
| **Backend** | FastAPI (Python 3.11+) + MongoDB — 96 pytest tests passing |
| **Frontend** | Next.js 15 (App Router) + React 19 + TypeScript strict + Tailwind CSS v4 — 24 vitest tests passing |
| **Local URLs** | Frontend `http://localhost:3000` · Backend API `http://localhost:8000/api/v1` · Interactive docs `http://localhost:8000/docs` |

## Feature summary

- Email/password authentication with JWT access tokens (bcrypt password hashing)
- Self-service registration with a role picker: customers and agents register
  openly; **admin** self-registration additionally requires `ADMIN_INVITE_CODE`
- Three roles — **customer**, **agent**, **admin** — enforced **server-side** on every
  request (frontend guards only shape navigation). Each role gets its own landing
  screen after sign-in (agent → ticket queue, customer/admin → dashboard)
- Tickets record **who solved them** (`resolved_by` / `resolved_at`); every ticket
  table shows a "Solved by" column
- Ticket CRUD with pagination, filtering, full-text-ish search and sorting
- Validated status workflow (`open → in_progress / pending / resolved / closed`, reopen
  from `closed`) — invalid transitions are rejected with `400`
- Public replies and **internal notes** (notes are never returned to customers)
- Assignment/unassignment restricted to agents and admins
- Categories with an admin-safe *deactivate* policy (never breaks existing tickets)
- Per-user in-app notifications (creation, assignment, reply, status change)
- Role-scoped analytics and admin-only audit logs
- Idempotent index creation at startup, fail-fast configuration checks

## Technology stack

| Layer | Technology |
|---|---|
| API | FastAPI 0.115, Uvicorn, Pydantic v2 / pydantic-settings |
| Database | MongoDB via PyMongo's built-in async API (`AsyncMongoClient`, ≥ 4.11) |
| Auth | PyJWT (HS256), bcrypt (12 rounds) |
| Tests (backend) | pytest + FastAPI TestClient (96 tests, isolated test database) |
| UI | Next.js 15.5, React 19, TypeScript (strict), Tailwind CSS v4, Radix UI primitives, react-hook-form + zod, Recharts, sonner |
| Tests (frontend) | Vitest + Testing Library (24 tests) |

## Repository layout

```
.
├── docs/          # This documentation set (start here)
├── frontend/      # Next.js app — see frontend/README.md
└── backend/       # FastAPI app — see backend/README.md
```

## Prerequisites

- **Python 3.11+** and **MongoDB 6+** (local `mongod` or a connection string)
- **Node.js 20+** (tested on Node 24) with npm 10+
- Windows + PowerShell friendly throughout (macOS/Linux work too)

## Quick start (two terminals)

**Terminal 1 — backend:**

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env      # then set a real JWT_SECRET (see below)
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 — frontend:**

```powershell
cd frontend
npm install
Copy-Item .env.example .env.local
npm run dev
```

Then:

1. (Optional) Set `ADMIN_INVITE_CODE` in `backend/.env` to allow
   self-service admin registration from the register screen. Admin
   accounts can also be seeded from the CLI:

   ```powershell
   cd backend
   python scripts/create_admin.py --email admin@example.com --name "Site Admin"
   ```

2. Open `http://localhost:3000` and register — pick **Customer** or
   **Agent** directly, or **Admin** with the invite code — then sign in.
3. API docs: `http://localhost:8000/docs`.

`JWT_SECRET` must be set to a long random value (e.g.
`python -c "import secrets; print(secrets.token_urlsafe(48))"`); the backend **refuses
to start** while it is missing or still the `.env.example` placeholder.
Full walkthroughs: [SETUP_GUIDE.md](SETUP_GUIDE.md) · [WINDOWS_SETUP.md](WINDOWS_SETUP.md)

## Verification status (what was actually run)

| Check | Command | Result |
|---|---|---|
| Backend tests | `cd backend; python -m pytest` | **96 passed** (~1m30s) against a dedicated `ticket_management_db_test` database |
| Backend live boot | `uvicorn app.main:app` | `/api/v1/health` → `{"status":"ok","database":"ok"}`; OpenAPI exposes the 25 documented operations |
| Frontend tests | `cd frontend; npm test` | **24 passed** |
| Frontend type-check | `cd frontend; npm run typecheck` | clean |
| Frontend lint | `cd frontend; npm run lint` | clean |

Details and known gaps: [TESTING.md](TESTING.md).

## Documentation map

| Document | Read it for |
|---|---|
| [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) | Purpose, scope, assumptions, limitations |
| [FEATURES.md](FEATURES.md) | Feature inventory with implementation status |
| [REQUIREMENTS.md](REQUIREMENTS.md) | Functional & non-functional requirements |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Components, request flows, diagrams |
| [DATABASE.md](DATABASE.md) · [DATABASE_INDEXES.md](DATABASE_INDEXES.md) | Collections, fields, indexes |
| [API_DOCUMENTATION.md](API_DOCUMENTATION.md) | Full endpoint reference with examples |
| [AUTHENTICATION_AND_AUTHORIZATION.md](AUTHENTICATION_AND_AUTHORIZATION.md) | Tokens, hashing, expiry, session behavior |
| [USER_ROLES_AND_PERMISSIONS.md](USER_ROLES_AND_PERMISSIONS.md) | Capability matrix per role |
| [TICKET_WORKFLOW.md](TICKET_WORKFLOW.md) | Status lifecycle, assignment, notes |
| [NOTIFICATIONS.md](NOTIFICATIONS.md) | Triggers, read behavior, limits |
| [FILE_ATTACHMENTS.md](FILE_ATTACHMENTS.md) | **Not implemented in v1** — status & future plan |
| [FRONTEND_GUIDE.md](FRONTEND_GUIDE.md) · [BACKEND_GUIDE.md](BACKEND_GUIDE.md) | Code-level guides per subproject |
| [SETUP_GUIDE.md](SETUP_GUIDE.md) · [WINDOWS_SETUP.md](WINDOWS_SETUP.md) | Local setup (general / PowerShell) |
| [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) | Every variable, default, and purpose |
| [USER_GUIDE.md](USER_GUIDE.md) · [AGENT_GUIDE.md](AGENT_GUIDE.md) · [ADMIN_GUIDE.md](ADMIN_GUIDE.md) | Role-based how-tos |
| [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) · [TESTING.md](TESTING.md) | Conventions, workflow, tests |
| [SECURITY.md](SECURITY.md) · [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Controls & limits · common fixes |
| [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) · [CONTRIBUTING.md](CONTRIBUTING.md) | Deploying · contributing |
| [CHANGELOG.md](CHANGELOG.md) · [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md) | History · future work |

## Known limitations & security notes (short list)

- **No file attachments** — v1 has no upload/download endpoints at all.
- **No password reset/change flow** — intentionally absent; don't advertise it.
- **Stateless JWT** — logout discards the token client-side; there is no server-side
  revocation list, so a stolen token remains valid until it expires.
- **Auth rate limiting is in-memory** (single uvicorn process) — production deployments
  must also rate-limit at the reverse proxy.
- Secrets live only in `.env` files (gitignored). Never commit real values; keep
  `.env.example` illustrative.

Full detail: [SECURITY.md](SECURITY.md).
