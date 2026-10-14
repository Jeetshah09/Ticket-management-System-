# Authentication & Authorization

How DeskFlow proves who you are (authentication) and decides what you may do
(authorization). Both are enforced **entirely on the backend**; the frontend's guards
only shape navigation and can always be bypassed with curl.

## Password handling

- Hashing: **bcrypt** with **12 rounds** and a unique per-password salt
  (`backend/app/core/security.py`). The stored value is the full bcrypt digest; there
  is no reversible storage of any kind.
- Password policy at registration: **8–72 characters** (bcrypt's safe input limit is
  72 bytes). No composition rules — deliberate simplicity.
- Verification failures never raise or distinguish formats; a malformed stored hash
  simply fails the check (constant behavior for unknown email vs wrong password: both
  are `401 "Invalid email or password."`).

## Tokens (JWT)

- Algorithm **HS256**, signed with `JWT_SECRET` (environment variable; startup refuses
  to run if it is missing or still the `.env.example` placeholder).
- Claims: `sub` (user id), `role`, `iat`, `exp`, and `typ: "access"`. A token whose
  `typ` is not `access` is rejected even if correctly signed — signed-but-wrong-kind
  tokens (e.g. a future refresh token) can never be replayed as access tokens.
- Lifetime: `ACCESS_TOKEN_EXPIRE_MINUTES` (default **720 minutes = 12 hours**).
- Transport: `Authorization: Bearer <token>` on every request.

### What is *not* implemented

| Mechanism | Status | Consequence |
|---|---|---|
| Refresh tokens | ❌ | One long-lived access token; re-login after expiry |
| Server-side revocation / blocklist | ❌ | **Logout is client-side**: `POST /auth/logout` returns 204 and the browser deletes the token. A *copied* token stays valid until `exp`. Mitigate by keeping the lifetime modest and guarding the secret. |
| Token binding to IP/device | ❌ | A token works from any client |
| MFA | ❌ | — |

If revocation becomes a requirement, the standard fix is a short denylist collection
checked in `get_current_user` — see [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md).

## Session lifecycle (as implemented)

1. `POST /auth/login` (or `/auth/register`) → `{ access_token, user }`.
2. Frontend stores **only the token** in `localStorage` under `tms.access_token`
   (never passwords or profile data).
3. Axios attaches it to every request. On any **401** from a non-auth endpoint the
   client clears the token and redirects to `/login?next=…`.
4. `POST /auth/logout` → 204; client clears the token and routes to `/login`.
5. Deactivating an account (`PATCH /users/{id}` `{"is_active": false}`) invalidates
   *future logins* (403) **and** kills existing tokens on their next use (the user
   document is re-fetched and checked on every authenticated request).

## Authorization model

Roles: `customer` · `agent` · `admin` (single enum in
`backend/app/models/enums.py`, mirrored in `frontend/types/auth.ts`).

Enforcement layers, in request order:

1. **`get_current_user`** (`app/dependencies/auth.py`) — resolves the bearer token to
   a fresh user document. 401 on missing/invalid/expired token; 403 if the account is
   deactivated.
2. **Role gates** — `require_roles(Role.agent, Role.admin)` / `require_admin`
   dependencies return 403 for wrong roles. Used by: assignment, users, categories
   mutation, analytics/agents, audit-logs.
3. **Object-level checks** (`app/services/tickets.py` and routers) — per-ticket
   visibility (who may read/write), per-notification ownership, customer restrictions
   (no status changes, no editing resolved/closed tickets, no internal notes), admin
   lockout guard (cannot demote/deactivate self).

### 401 vs 403 vs 404 policy

| Situation | Code | Rationale |
|---|---|---|
| No/invalid/expired token | 401 | Not authenticated |
| Authenticated, wrong role | 403 | You exist but may not |
| Account deactivated | 403 | Clear signal to contact an admin |
| Ticket/notification you may not see | **404** | Avoid leaking existence of other users' data |
| Wrong email **or** wrong password | 401 (same message) | Avoid account enumeration |

The role stored **inside the JWT is advisory** — every request re-reads the user
document from MongoDB, so demoting or deactivating a user takes effect immediately,
without waiting for token expiry.

## Rate limiting (authentication only)

- In-memory sliding window on `POST /auth/login` and `POST /auth/register`, per client
  IP: `AUTH_RATE_LIMIT_PER_MINUTE` (default 10/min; `0` disables — tests disable it).
- Tripped limit → **429** `"Too many attempts. Please wait a minute and try again."`
- **Limitation:** the counter lives in one uvicorn process. Multiple workers or
  instances each enforce their own limit; horizontal deployments must also rate-limit
  at the reverse proxy. See [SECURITY.md](SECURITY.md).

## CORS

Allowed browser origins come from `CORS_ORIGINS` (comma-separated; default
`http://localhost:3000,http://localhost:5173`). Credentials are allowed for these
origins. There is no wildcard default — production deployments must list their real
frontend origin.

## Frontend's (non-security) role checks

`frontend/contexts/route-guards.tsx` wraps the authenticated area in `RequireAuth`
(redirect to `/login?next=…` when signed out) and `/admin/*` in
`RequireRole(["admin"])` (friendly access-denied view). Navigation items adapt per
role (`components/layout/nav-config.ts`). **None of this is a security boundary** —
the backend answers 403/404 regardless, and the frontend renders those as access-
denied/error states.

## Security-relevant operational checklist

1. Set a long random `JWT_SECRET` (≥ 32 bytes): `python -c "import secrets;
   print(secrets.token_urlsafe(48))"`.
2. Never reuse the dev secret in any shared environment.
3. Keep `ACCESS_TOKEN_EXPIRE_MINUTES` aligned with your risk tolerance.
4. Restrict `CORS_ORIGINS` to the real frontend origin(s).
5. Put the API behind TLS in production — Bearer tokens are secrets in transit.

Full control inventory and limitations: [SECURITY.md](SECURITY.md).
