# Troubleshooting

Common problems with this exact stack (FastAPI + PyMongo async + MongoDB + Next.js
15), the error text you'll actually see, and the fix. Ordered by how often they bite
new setups.

## Backend won't start

### `Refusing to start: missing essential configuration: JWT_SECRET …`

`backend/.env` is missing, empty for `JWT_SECRET`, or still contains the
`.env.example` placeholder (`change-me-to-a-long-random-string` — the app detects
that exact string and refuses).

```powershell
cd backend
Copy-Item .env.example .env
python -c "import secrets; print(secrets.token_urlsafe(48))"
# paste output into .env as JWT_SECRET=...
```

Also: uvicorn resolves `.env` from the **working directory** — start it from
`backend/`, not the repo root.

### `Cannot reach MongoDB at 'mongodb://127.0.0.1:27017': …`

MongoDB isn't running or `MONGO_URI` points elsewhere.

```powershell
net start MongoDB                      # service (may need admin PowerShell)
# or manual:
New-Item -ItemType Directory -Force C:\data\db
mongod --dbpath C:\data\db
```

Verify with `mongosh --eval "db.adminCommand('ping")`. If your URI has credentials,
check them; the error line echoes the URI (but not the password beyond what you put
in it — keep URIs out of committed files).

### `Address already in use` / port 8000 busy

Another process (often your own earlier uvicorn, possibly orphaned by a closed
terminal) holds the port.

```powershell
netstat -ano | findstr :8000
taskkill /PID <pid> /F                # PowerShell; on Git Bash: taskkill //PID <pid> //F
```

Or run on another port: `python -m uvicorn app.main:app --port 8001` (and update
`NEXT_PUBLIC_API_BASE_URL` to `http://localhost:8001/api/v1`).

### `ModuleNotFoundError: No module named 'app'`

uvicorn/pytest started outside `backend/` or the venv isn't active.

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload     # always via python -m
```

### `ImportError: cannot import name 'AsyncDatabase' from 'pymongo'`

You have pymongo < 4.11 (no async API). The code supports 4.11+ (with a fallback
import for 4.11's `pymongo.asynchronous.database` location).

```powershell
python -m pip install -r requirements.txt   # installs pymongo>=4.11
```

## Frontend problems

### Login works but every page says "Cannot reach the server"

The frontend points at the wrong backend URL. Check `frontend/.env.local`:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
```

Restart `npm run dev` after editing (env is read at start). Confirm the backend is
up: `Invoke-RestMethod http://127.0.0.1:8000/api/v1/health`.

### CORS error in the browser console ("blocked by CORS policy")

The backend didn't allow your origin. Ensure `backend/.env` has:

```
CORS_ORIGINS=http://localhost:3000
```

and **restart the backend** after editing. Origins are comma-separated, exact-match,
scheme+port sensitive (`http` vs `https`, `:3000` vs no port).

### Immediately bounced to `/login` though I just registered

The session wasn't persisted (private-browsing storage blocked) or the token
expired. Log in again; if it persists, check the browser console for
`localStorage` errors and try a normal window.

### "Too many attempts. Please wait a minute and try again." (429)

Auth rate limit (default 10 login/register attempts per minute per IP) — wait 60
seconds, or raise/disable in `backend/.env`:

```
AUTH_RATE_LIMIT_PER_MINUTE=0     # dev only — never in production
```

### `npm` install fails or `ELIFECYCLE` errors

Stale `node_modules` (different OS or Node version):

```powershell
cd frontend
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json   # only if the lockfile itself is corrupt
npm install
```

Node 20+ is required (`node --version`).

### Next.js build/type errors after editing types

The API contract lives in `frontend/types/`. If the backend added/renamed a field:

```powershell
cd frontend
npm run typecheck
```

and align `types/` with the Pydantic models ([API_DOCUMENTATION.md](API_DOCUMENTATION.md)).

## Data & workflow oddities

### Categories list is empty on the ticket form

Categories are admin-created; the database starts empty. Sign in as the seeded
admin → **Categories** → create one. (There are no default categories — seeding them
is a decision for your deployment.)

### I seeded an admin but login says invalid credentials

`create_admin.py` creates/promotes an account — it does not change an existing
user's password. Re-run it and set the password when prompted, or register a fresh
account and promote it. Remember the password prompt doesn't echo.

### Customer can't edit a ticket anymore

By design: resolved/closed tickets are frozen for customers (400). An agent can
reopen (`closed → open`) or return it to `in_progress`/`pending`.

### An agent can't see a ticket another agent is working

Queue rules: agents see own + assigned-to-them + unassigned. Tickets assigned to
colleagues are hidden. An admin can reassign ([AGENT_GUIDE.md](AGENT_GUIDE.md)).

### Status won't change to X

The state machine rejected it (400). Allowed transitions are in
[TICKET_WORKFLOW.md](TICKET_WORKFLOW.md); e.g. `closed` can only go to `open`.

### Notifications bell shows a count but the page is empty

You're likely filtered to `Unread` and just marked items read; switch the filter.
Counts come from the API (`unread_count`) — reload if a stale tab confuses you (no
real-time push in v1).

## Test-suite issues

### Backend tests skip with "MongoDB is not reachable"

Intentional: the suite is optional about external services. Start mongod, or point
tests elsewhere: `$env:MONGO_URI="mongodb://…"` before `python -m pytest`.

### Tests fail with duplicate email / leftover data

Each run uses unique emails and drops `ticket_management_db_test` afterwards. If a
previous run was killed mid-flight, drop the test database manually:

```javascript
// mongosh
use ticket_management_db_test
db.dropDatabase()
```

Your real `ticket_management_db` is never used by tests.

### `vitest` can't resolve `@/...` aliases

Run vitest from `frontend/` (the config defines the alias); don't run it from the
repo root.

## Getting more detail

- Backend terminal logs every startup/shutdown and full tracebacks for unexpected
  errors (clients only ever get a generic 500).
- `http://localhost:8000/docs` — live schema for trying endpoints with your token
  (use the **Authorize** button to paste `Bearer <token>`).
- Health: `Invoke-RestMethod http://127.0.0.1:8000/api/v1/health`.
- Still stuck: [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for exact status-code
  semantics (400 vs 401 vs 403 vs 404 vs 409 vs 422 vs 429).
