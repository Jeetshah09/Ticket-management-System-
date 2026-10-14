# Environment Variables

Every variable read by the code, its default, and its effect. **No real secrets are
present in this document** — values shown are illustrative placeholders only.

## Backend (`backend/.env`)

Read by `app/core/config.py` (pydantic-settings). The file is loaded from the
**working directory**, so start uvicorn from `backend/`. Environment variables
override `.env` values. `.env` is gitignored; `.env.example` holds placeholders only.

| Variable | Required | Default (code) | Example placeholder | Purpose / effect |
|---|---|---|---|---|
| `MONGO_URI` | no | `mongodb://127.0.0.1:27017` | `mongodb://127.0.0.1:27017` | MongoDB connection string. Startup pings it and fails fast with a readable error if unreachable. |
| `MONGO_DB` | no | `ticket_management_db` | `ticket_management_db` | Database name. Tests always use `ticket_management_db_test` regardless of this value. |
| `JWT_SECRET` | **yes** | — (empty) | *a long random string* | HS256 signing key. **Startup refuses to run** when empty or still equal to the `.env.example` placeholder. Generate: `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `JWT_ALGORITHM` | no | `HS256` | `HS256` | JWT signing algorithm. Only `HS256` is exercised/verified by the code — change it only if you also change token verification everywhere. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | no | `720` (12 h) | `720` | JWT lifetime in minutes. |
| `CORS_ORIGINS` | no | `http://localhost:3000,http://localhost:5173` | `http://localhost:3000` | Comma-separated browser origins allowed by CORS. No wildcard default. |
| `AUTH_RATE_LIMIT_PER_MINUTE` | no | `10` | `10` | In-memory sliding-window limit for `POST /auth/login` and `POST /auth/register` per client IP. `0` disables (tests set 0). Single-process only — see [SECURITY.md](SECURITY.md). |
| `ADMIN_INVITE_CODE` | no | *(empty)* | *(empty)* | Invite code required to self-register an **admin** account from the register screen. Customers and agents never need it. Empty disables admin self-registration (seed admins with `scripts/create_admin.py`). |
| `APP_NAME` | no | `Ticket Management API` | — | Cosmetic; appears in OpenAPI title. |
| `API_V1_PREFIX` | no | `/api/v1` | — | Route prefix. Changing it also breaks the frontend's default base URL — update `NEXT_PUBLIC_API_BASE_URL` to match. |

Unknown variables are ignored (`extra="ignore"`), so extra lines in `.env` are harmless.

### Fail-fast behavior

On startup the app validates configuration **before serving traffic**:

1. `JWT_SECRET` missing or still the placeholder → raises with
   `Refusing to start: missing essential configuration: …` naming the variable.
2. MongoDB unreachable → `Cannot reach MongoDB at '<uri>': …` with a hint to start
   mongod or fix `MONGO_URI`.

There is no "run anyway" mode.

### `.env.example` (backend)

```
MONGO_URI=mongodb://127.0.0.1:27017
MONGO_DB=ticket_management_db
JWT_SECRET=change-me-to-a-long-random-string     # ← must be replaced
ACCESS_TOKEN_EXPIRE_MINUTES=720
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
AUTH_RATE_LIMIT_PER_MINUTE=10

# Invite code required for admin self-registration (empty = disabled).
# ADMIN_INVITE_CODE=change-me-to-a-long-random-code
```

## Frontend (`frontend/.env.local`)

Read by Next.js at build/start. `.env.local` is gitignored.

| Variable | Required | Default | Example | Purpose |
|---|---|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | no (sensible default) | `http://localhost:8000/api/v1` | `https://api.example.com/api/v1` | Base URL of the FastAPI backend **including the `/api/v1` prefix**. Used by `lib/api-client.ts`. |

The `NEXT_PUBLIC_` prefix makes the value public in the browser bundle by design — it
is only an API origin, never a secret. **The frontend stores no other environment
variables and no secrets**; passwords go directly to the backend over the wire.

Restart `npm run dev` after changing `.env.local` (env files are read at start).

## Variables referenced but NOT implemented

To prevent cargo-culting, these do **not** exist anywhere in the code — do not add
them expecting behavior:

- `EMAIL_*` / SMTP settings — there is no email subsystem.
- `REDIS_URL` — no Redis usage.
- `MAX_UPLOAD_MB` — attachments are not implemented
  ([FILE_ATTACHMENTS.md](FILE_ATTACHMENTS.md)).
- `JWT_REFRESH_*` — no refresh tokens.

## Where each variable is consumed

| Variable | Consumed in |
|---|---|
| `MONGO_URI`, `MONGO_DB` | `app/core/config.py` → `app/db/mongo.py::connect` |
| `JWT_SECRET`, `ACCESS_TOKEN_EXPIRE_MINUTES` | `app/core/security.py` via routers (`create_access_token`) and `app/dependencies/auth.py` (`decode_access_token`) |
| `CORS_ORIGINS` | `app/main.py` (CORSMiddleware) |
| `AUTH_RATE_LIMIT_PER_MINUTE` | `app/core/rate_limit.py` |
| `NEXT_PUBLIC_API_BASE_URL` | `frontend/lib/api-client.ts` (axios `baseURL`) |
