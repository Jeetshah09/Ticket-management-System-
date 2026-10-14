# Changelog

All notable changes to DeskFlow, most recent first. Dates are omitted because this
repository carries no authoritative release history — entries are grouped by the
order work is known to have happened, not by invented dates. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/).

## [Unreleased] — v1 (initial implementation)

The first complete, working version of the system: a conventional ticketing/helpdesk
application with **no AI/LLM features** by design.

### Added — Backend (`backend/`)

- FastAPI application (Python 3.11+, Uvicorn) with `/api/v1` prefix, app factory,
  lifespan-managed startup/shutdown, and CORS from environment configuration.
- MongoDB persistence via **PyMongo's built-in async API** (`AsyncMongoClient`,
  pymongo ≥ 4.11, no ORM, no Motor): 7 collections (`users`, `tickets`,
  `ticket_messages`, `categories`, `notifications`, `audit_logs`, `counters`) with
  idempotent index creation at startup.
- Authentication: customer registration (role always server-assigned), login,
  `GET/PATCH /auth/me`, stateless logout; **bcrypt** (12 rounds) password hashing;
  JWT (HS256) access tokens with `typ` claim, expiry, and fail-fast secret
  validation at startup.
- Role-based authorization (customer / agent / admin) enforced server-side on every
  request: role gates, per-object visibility (404 for invisible resources — no
  existence leaks), customer restrictions, admin lockout guard.
- Tickets: create (human-readable ticket numbers via `counters`), role-scoped list
  with pagination/filtering/whitelisted sorting/regex-escaped search, detail with
  conversation, field updates, **validated status state machine**
  (`ALLOWED_TRANSITIONS`), assignment/unassignment restricted to active staff.
- Messages: public replies and **internal notes** (staff-only; never serialized to
  customers), chronological ordering, denormalized `message_count`.
- Categories: list (active-only for non-admins), admin CRUD-with-deactivation
  (safe for historical tickets), usage counts.
- Notifications: in-app events (ticket created → staff pool, assignment, reply,
  status change), owner-scoped list with unread counter, mark-one/mark-all-read.
- Analytics: role-scoped overview (totals, status/priority/category buckets,
  14-day zero-filled creation trend), admin-only per-agent workload report.
- Audit logs: auth events, ticket lifecycle, category/user administration;
  admin-only access with action/actor/entity filters; excludes passwords, tokens
  and message bodies.
- Observability & safety: centralized exception handling (no stack traces to
  clients), health/readiness endpoint, in-memory rate limiting on auth routes,
  `.env.example` with placeholders only.
- Admin seeding CLI `scripts/create_admin.py` (interactive password, no default;
  idempotent promotion; audited).
- pytest suite: **96 tests** against an isolated test database (auto-skips when
  MongoDB is unreachable) covering auth, permissions, lifecycle, privacy, admin
  surfaces, health and OpenAPI integrity.

### Added — Frontend (`frontend/`)

- Next.js 15 (App Router, Turbopack) + React 19 + TypeScript (strict) + Tailwind
  CSS v4 app named **DeskFlow**, with Radix-based UI primitives and
  react-hook-form + zod forms.
- Public landing, login, register; authenticated area (`RequireAuth`) with
  role-aware dashboard (Recharts status/priority/trend charts, admin workload
  chart), ticket list (filters/sort/pagination/search), new-ticket form, ticket
  detail (conversation, reply/internal-note form, agent/admin action panel with
  status select and assignment), notifications center + header bell, profile
  editor, and admin area (`RequireRole`) for users, categories, audit logs.
- Axios client with Bearer token injection, 15 s timeout, 401 → login redirect
  with `next` param; normalized `ApiError` with field-level errors mapped onto
  forms; `useApi` loading/error/retry hook; explicit loading skeletons, error and
  empty states on every data view.
- localStorage token persistence (`tms.access_token`, token only — no profile or
  password data).
- Accessibility: labeled fields, aria wiring, text labels alongside color for
  status/priority/role, focus-trapped Radix dialogs, reduced-motion support.
- Vitest + Testing Library suite: **24 tests** (API error normalization, pagination
  envelope adaptation, permission helpers, badge labels, login flow).

### Added — Documentation (`docs/`)

- Complete documentation set: overview, features/status matrix, requirements,
  architecture (with diagrams), database & indexes, full API reference,
  authentication/authorization, roles & permissions matrix, ticket workflow,
  notifications, attachment status, frontend/backend guides, setup (general +
  Windows PowerShell), environment variables, user/agent/admin guides, developer
  guide, testing, security, troubleshooting, deployment, contributing, roadmap.

### Known limitations (v1)

- **Not implemented:** file attachments (no endpoints exist), password
  reset/change, refresh tokens, server-side token revocation, email/push delivery,
  real-time updates, CI pipeline, E2E tests.
- **Partially implemented:** auth rate limiting (in-memory, single process);
  logout (stateless, client-side discard); basic stdlib logging only.

See [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md) for planned follow-ups and
[FEATURES.md](FEATURES.md) for the per-feature status matrix.
