# Security

Security controls that are **actually implemented**, the data-handling rules, and —
candidly — the limitations. Nothing here claims production readiness; read
[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) before exposing anything publicly.

## Trust model

The browser is untrusted. Every request is authenticated (JWT) and authorized
(server-side, per object) again on the backend; frontend role checks only shape
navigation. A user with `curl` can attempt anything the UI can, and the same rules
apply.

## Implemented controls

### Authentication

| Control | Implementation |
|---|---|
| Password storage | bcrypt, **12 rounds**, unique per-password salt; only the digest is stored (`app/core/security.py`) |
| Password input limits | 8–72 chars at registration (bcrypt's 72-byte safe limit) |
| Login anonymity | Identical `401 "Invalid email or password."` for unknown email and wrong password; no timing-shortcut endpoint |
| Tokens | JWT **HS256** with `sub`, `role`, `iat`, `exp`, `typ:"access"`; non-`access` tokens rejected even if correctly signed |
| Secret handling | `JWT_SECRET` from environment; **startup refuses to run** when missing or still the `.env.example` placeholder |
| Token lifetime | `ACCESS_TOKEN_EXPIRE_MINUTES` (default 720 min); expired tokens → 401 |
| Brute-force damping | In-memory sliding-window rate limit on `/auth/login` and `/auth/register` per IP (default 10/min → 429) |
| Admin bootstrapping | No public admin registration; first admin via interactive CLI with **no default password** |

### Authorization

- Role gates (`require_agent` / `require_admin`) on all staff endpoints; object-level
  checks for ticket visibility, notification ownership, category mutation.
- **No existence leaks**: objects you may not see answer **404**, not 403 — for
  tickets, users (non-admin paths), and notifications.
- Fresh user document on **every** request: demotion or deactivation applies
  immediately (JWT role claim is advisory only).
- Customers: cannot change status (403), cannot edit resolved/closed tickets (400),
  cannot post or receive internal notes (403 / filtered server-side).
- Admin lockout guard: an admin cannot demote or deactivate their own account (400).
- Assignment restricted to active agents/admins (400 otherwise).

### Input handling

- All request bodies validated by Pydantic with **`extra="forbid"`** — unknown
  fields (e.g. `role` on register, `is_active` on profile update) are hard 422
  errors, never silently honored.
- Enum-typed fields (status/priority/visibility/role/sort) — invalid values are 422.
- Sort fields are whitelisted (`created_at|updated_at|priority|status`); anything
  else → 422 (no sort-key injection).
- Search terms are **regex-escaped** before being placed in a `$regex` query.
- ObjectIds validated at the boundary; malformed path ids → 404, malformed body ids
  → 422.

### Data exposure

- `password_hash` is never serialized in any response (asserted in tests).
- Error responses never contain stack traces, file paths, DB URIs, or secrets —
  unexpected exceptions become a generic `{"detail": "Internal server error."}`
  (500) with details only in server logs.
- Health endpoint reports `ok/degraded` only — no diagnostics.
- Audit logs exclude passwords, tokens, and message bodies (test asserts no
  "password"/"token" strings in the audit API output).
- Notifications are queried with the caller's `user_id` — cross-user reads are
  structurally impossible through the API.
- CORS origins come from configuration; **no wildcard default**.

### Operational

- `.env` / `.env.local` are gitignored in both subprojects; `.env.example` files
  contain placeholders only.
- MongoDB connection failure and missing configuration are **fail-fast** at startup —
  the server never runs with degraded security settings.
- Dependencies are pinned to sane ranges (FastAPI 0.115.x, PyJWT 2.x, bcrypt 3.2+/4.x,
  Next.js 15.5).

## Sensitive-data handling map

| Data | Where it lives | Never |
|---|---|---|
| Password | bcrypt digest in `users.password_hash` only | logged, returned, emailed (there is no email) |
| JWT | client `localStorage` (`tms.access_token`); verified server-side | logged; stored server-side; echoed in audit logs |
| Email | `users.email` (lowercased) | exposed to non-admins in user lists; other users' notifications |
| Message bodies | `ticket_messages.body` | written to audit logs; truncated (140 chars) when used in notification bodies |
| Client IP | `audit_logs.ip_address` where available | — |

## Known limitations (read before production)

1. **No server-side token revocation.** Logout is client-side; a *copied* JWT stays
   valid until `exp` (default 12 h). Mitigation today: moderate lifetime, protect
   `JWT_SECRET`. Real fix: denylist collection checked in `get_current_user`
   ([DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md)).
2. **In-memory rate limiting** — one process only; multiple workers/instances
   multiply the effective limit. Production must add proxy-level rate limiting.
3. **No MFA, no refresh tokens, no password reset/change, no account lockout after
   N failures** (beyond the per-minute rate limit), no email verification.
4. **No TLS termination in-app** — deploy behind HTTPS; Bearer tokens are secrets in
   transit.
5. **Tokens in `localStorage`** are readable by any XSS-executed script. Mitigated by
   React's escaping and Next.js CSP defaults, but not eliminated; httpOnly cookies
   would be the upgrade path (isolated change in `lib/token.ts` +
   `lib/api-client.ts`).
6. **No security headers management** (HSTS, CSP, X-Frame-Options) — a reverse
   proxy should set them ([DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)).
7. **No dependency-vulnerability scanning** in-repo (no CI). Run `npm audit` and
   `pip-audit` manually.
8. **Regex substring search** is fine for small data but not an injection risk due
   to escaping; it is not a full-text search either.
9. **No file handling at all** — attachments are unimplemented
   ([FILE_ATTACHMENTS.md](FILE_ATTACHMENTS.md)), which also means no upload attack
   surface today.
10. **Audit log is tamper-evident only by access control** — admins can read but not
    modify it *through the API*; anyone with DB access can alter it. No
    append-only/WORM guarantee.

## Reporting a vulnerability

This is a student/class project with no formal bug-bounty program. If you find an
issue:

1. **Do not** open a public issue with exploit details.
2. Report privately to the project maintainer (repository owner) with: what you
   found, affected endpoint/path, reproduction steps, and impact.
3. Allow reasonable time for a fix before disclosure.

For educational context, the highest-value reports would be: any path that lets a
customer read another user's ticket/messages/notifications, any way to escalate to
admin without the CLI/promotion, and any injection (NoSQL/regex/XSS) through ticket
or message content.
