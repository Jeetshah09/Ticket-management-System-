# Windows Setup (PowerShell)

Windows-specific commands and gotchas for running DeskFlow. The general flow is in
[SETUP_GUIDE.md](SETUP_GUIDE.md); this page is the PowerShell flavor with the traps
called out.

All commands assume **PowerShell 5.1+** (Windows PowerShell or PowerShell 7) from the
repository root unless a `cd` is shown.

## 1. Prerequisites on Windows

| Tool | Install | Verify |
|---|---|---|
| Python 3.11+ | [python.org](https://python.org) or `winget install Python.Python.3.12` | `python --version` |
| Node.js 20+ | [nodejs.org](https://nodejs.org) or `winget install OpenJS.NodeJS.LTS` | `node --version` |
| MongoDB 6+ | MSI from mongodb.com, or `winget install MongoDB.Server`; default service on port 27017 | `net start MongoDB` (may need elevation) |

Notes:

- If `python` opens the Microsoft Store stub, run `py -3 --version` instead and use
  `py -3 -m venv .venv` below.
- Add Python/Node to `PATH` during install, or commands below will not be found.

## 2. Database

```powershell
# If installed as a service:
Get-Service MongoDB | Select-Object Status   # should be Running
Start-Service MongoDB                        # if stopped (may need admin PowerShell)

# Manual run instead:
New-Item -ItemType Directory -Force C:\data\db
mongod --dbpath C:\data\db
```

Keep the mongod window open while developing, or install it as a service.

## 3. Backend in PowerShell

```powershell
cd backend

python -m venv .venv
# Activation (per window — activation does NOT persist across new windows):
.\.venv\Scripts\Activate.ps1

# If activation is blocked by execution policy (one-time, current user):
#   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned

python -m pip install --upgrade pip
python -m pip install -r requirements.txt

Copy-Item .env.example .env
# Generate a secret and put it into .env as JWT_SECRET=... :
python -c "import secrets; print(secrets.token_urlsafe(48))"

python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Notes:

- **A new terminal = re-activate**: `cd backend; .\.venv\Scripts\Activate.ps1`.
- The backend reads `backend/.env` from the working directory — start uvicorn **from
  `backend/`** (or the `.env` file won't be found and `JWT_SECRET` will look missing).
- Firewall prompt on first run: allow Python on private networks for localhost work.

### Seed the admin

```powershell
# (venv activated, cwd = backend)
python scripts/create_admin.py --email admin@example.com --name "Site Admin"
```

The password prompt does not echo; there is no default password.

## 4. Frontend in PowerShell

```powershell
# new terminal
cd frontend
npm install
Copy-Item .env.example .env.local
npm run dev
```

- The dev server uses Turbopack (`next dev --turbopack`), Node 20+ required.
- `Copy-Item` is the PowerShell `cp`; in Git Bash use `cp .env.example .env.local`.

## 5. Run tests on Windows

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -m pytest          # 96 tests; uses ticket_management_db_test, drops it after

cd ..\frontend
npm test                  # 24 vitest tests
npm run typecheck
npm run lint
```

## 6. Windows-specific gotchas

| Symptom | Cause | Fix |
|---|---|---|
| `python` opens Microsoft Store | App Execution Aliases | `py -3 -m venv .venv` and use `py -3` everywhere, or disable the aliases in Settings |
| `.\.venv\Scripts\Activate.ps1` refuses to run | Execution policy | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| Backend says `JWT_SECRET` missing although `.env` exists | uvicorn started outside `backend/` | `cd backend` first; the `.env` is resolved from the working directory |
| `mongod` exits immediately | Missing `--dbpath` directory | `New-Item -ItemType Directory -Force C:\data\db` then retry |
| Port 8000/3000 already in use | Another process (possibly your own earlier uvicorn/next) | `netstat -ano | findstr :8000` then `taskkill /PID <pid> /F` |
| npm `ELIFECYCLE` errors | Stale `node_modules` from another OS/Node version | `Remove-Item -Recurse -Force node_modules; npm install` |
| PowerShell blocks `taskkill` flags | Git Bash vs cmd flag syntax | In PowerShell use `taskkill /PID 1234 /F` (single slash) |
| CORS errors in the browser | Backend not running, or origin missing | Ensure the API is on :8000 and `CORS_ORIGINS` in `backend/.env` contains `http://localhost:3000` |

## 7. Handy PowerShell one-liners

```powershell
# health check
Invoke-RestMethod http://127.0.0.1:8000/api/v1/health

# regenerate the JWT secret
python -c "import secrets; print(secrets.token_urlsafe(48))"

# full backend restart: stop whatever holds :8000, then restart uvicorn
netstat -ano | findstr :8000
```

More problems → [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
