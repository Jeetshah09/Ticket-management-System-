# Setup Guide

Full local setup from a clean checkout, on any OS (commands shown for PowerShell;
[WINDOWS_SETUP.md](WINDOWS_SETUP.md) collects the Windows-specific notes). Two
terminals are needed — one for the backend, one for the frontend — plus a running
MongoDB.

## 0. Prerequisites

| Tool | Version | Check |
|---|---|---|
| Python | 3.11+ | `python --version` |
| MongoDB | 6+ running locally (or a URI you can reach) | `mongod --version` / connect with mongosh |
| Node.js | 20+ (tested with 24) | `node --version` |
| npm | 10+ | `npm --version` |

## 1. Get the code

```powershell
git clone <repo-url>
cd <repo-root>          # contains frontend/, backend/, docs/
```

## 2. Database

Start MongoDB on the default port (27017), for example:

```powershell
# Windows (if MongoDB is installed as a service, it may already run)
net start MongoDB
# or manual:
mongod --dbpath C:\data\db
```

No migrations or seed steps are needed: the backend creates all indexes idempotently
on first start ([DATABASE_INDEXES.md](DATABASE_INDEXES.md)).

## 3. Backend (terminal 1)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1          # PowerShell  — macOS/Linux: source .venv/bin/activate
python -m pip install -r requirements.txt

Copy-Item .env.example .env           # PowerShell — macOS/Linux: cp .env.example .env
```

Edit `backend/.env` and set a **real** JWT secret (the server refuses to start with
the placeholder):

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
# paste the output as JWT_SECRET=... in .env
```

Start the API:

```powershell
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Verify: `http://localhost:8000/api/v1/health` should return
`{"status":"ok","database":"ok"}` and `http://localhost:8000/docs` should show the
Swagger UI. Startup fails fast with a readable message if `JWT_SECRET` is missing or
MongoDB is unreachable.

### Seed the first administrator (required for admin features)

```powershell
python scripts/create_admin.py --email admin@example.com --name "Site Admin"
# prompts for a password (no default, not echoed)
```

Re-running with an existing email promotes that account back to admin — safe to re-run.

## 4. Frontend (terminal 2)

```powershell
cd frontend
npm install
Copy-Item .env.example .env.local      # creates NEXT_PUBLIC_API_BASE_URL
npm run dev
```

Open `http://localhost:3000`. The only environment variable is
`NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:8000/api/v1`). Env files are
read at start — restart `npm run dev` after changing them.

## 5. First run — smoke checklist

1. Register a **customer** at `http://localhost:3000/register`.
2. Create a ticket (category list should be non-empty once an admin has added
   categories; create one via `/admin/categories` as the seeded admin).
3. Sign out, sign in as the admin, open **Users** → promote the customer to
   *agent* if you want to test the queue view.
4. As the agent: open **Ticket Queue**, reply, change status, assign to self.
5. Check the customer's **Notifications** bell shows the reply.
6. Admin: **Dashboard** charts, **Audit Logs** shows the actions from steps 1–5.

## 6. Running the tests

```powershell
# backend (uses the dedicated ticket_management_db_test database, dropped after run;
# skips cleanly if MongoDB is unreachable)
cd backend
python -m pytest

# frontend (vitest)
cd frontend
npm test
npm run typecheck        # tsc --noEmit
npm run lint             # eslint
```

Expected results are documented in [TESTING.md](TESTING.md).

## 7. Environment files summary

| File | Copied to | Contains |
|---|---|---|
| `backend/.env.example` | `backend/.env` | `MONGO_URI`, `MONGO_DB`, `JWT_SECRET` (placeholder — replace!), optional tuning |
| `frontend/.env.example` | `frontend/.env.local` | `NEXT_PUBLIC_API_BASE_URL` |

Both `.env` and `.env.local` are gitignored; never commit real secrets. Full
reference: [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md).

## 8. Default URLs

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000/api/v1 |
| Swagger UI | http://localhost:8000/docs |
| OpenAPI JSON | http://localhost:8000/openapi.json |
| Health | http://localhost:8000/api/v1/health |
| MongoDB | mongodb://127.0.0.1:27017 |

There are **no default user credentials** — accounts are created by registration or
the admin CLI. Troubleshooting: [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
