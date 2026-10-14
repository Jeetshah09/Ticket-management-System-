# Developer Guide

Orientation for developers joining the project: how the codebase is organized, the
conventions it follows, and the day-to-day workflow. Deep dives:
[BACKEND_GUIDE.md](BACKEND_GUIDE.md) · [FRONTEND_GUIDE.md](FRONTEND_GUIDE.md) ·
[ARCHITECTURE.md](ARCHITECTURE.md).

## The five-minute mental model

```
Browser ── Next.js 3000 ── JSON+JWT ──▶ FastAPI 8000 ──▶ MongoDB 27017
   UI, guards,                      business rules,        7 collections
   no mock data                     authz, audit           no ORM
```

- **One contract, two implementations of it**: `backend/app/models/` (Pydantic) is
  the source of truth; `frontend/types/` mirrors it in TypeScript. When either
  changes, change both in the same commit.
- **The backend is the only security boundary.** Frontend guards/permissions shape
  navigation; every request is re-authorized server-side.
- **No AI features anywhere** — this is intentionally a conventional helpdesk.

## Repository layout

```
.
├── docs/          # this documentation set
├── frontend/      # Next.js 15 app (App Router, React 19, TS strict, Tailwind v4)
└── backend/       # FastAPI app (Pydantic v2, PyMongo async, JWT/bcrypt)
```

Start each subproject's guide for file-level detail; the READMEs
([frontend/README.md](../frontend/README.md),
[backend/README.md](../backend/README.md)) cover running each in isolation.

## Conventions

### Backend

- **Layers**: routers (`app/api/v1/`) = HTTP only; services (`app/services/`) =
  business rules (testable without HTTP); `app/utils/serialize.py` = the only place
  Mongo documents become response dicts. No repository layer by design.
- **Models**: request models extend `ApiModel` (`extra="forbid"`) so unknown fields
  (e.g. `role` on register) are 422s, never silently dropped. Enums live once in
  `app/models/enums.py`.
- **Errors**: raise `HTTPException` with a human-readable `detail`; clients never
  see stack traces (central handler in `app/core/errors.py`). Use 404 — not 403 —
  for objects the caller may not see, to avoid leaking existence.
- **Side effects** (audit, notifications) are best-effort: log-and-continue, never
  fail the user's request.
- **IDs**: validate ObjectIds at the boundary; serialize as lowercase hex strings.
- **Async PyMongo**: `find()` → cursor directly; `await coll.aggregate(...)` → cursor
  (see [BACKEND_GUIDE.md](BACKEND_GUIDE.md#key-mechanisms-worth-knowing)).

### Frontend

- New API surface → `types/` first, then a function in `services/`, then `useApi`
  in the component. Never call `fetch`/axios directly outside `services/`.
- Every data region renders loading (skeleton) / error (retry) / empty states.
- Display labels/colors for enums live in `lib/constants.ts`; values in `types/`.
  Both mirror the backend.
- `lib/permissions.ts` is UI shaping only — never a reason to skip a request.
- Accessibility floor: labeled inputs, text labels alongside color, Radix dialogs
  (focus trap/Esc), `prefers-reduced-motion`.

### Both

- No secrets in code or committed env files (`.env*` gitignored; `.env.example` /
  `.env.local` keep placeholders).
- No new infrastructure (Redis, queues, ORMs) without an explicit requirement.
- Keep the three top-level folders (`docs/`, `frontend/`, `backend/`) as the only
  project roots.

## Development workflow

1. **Branch**: `git checkout -b feature/<short-name>` (see
   [CONTRIBUTING.md](CONTRIBUTING.md) for the branching/commit scheme).
2. **Backend loop**: `cd backend; .\.venv\Scripts\Activate.ps1; python -m uvicorn
   app.main:app --reload` — reload picks up changes; startup failures (bad import,
   missing secret) surface in the terminal immediately.
3. **Frontend loop**: `cd frontend; npm run dev` (Turbopack HMR).
4. **API schema**: after backend changes, open `http://localhost:8000/docs` and
   confirm the route/models look right; the frontend contract lives in `types/`.
5. **Tests before handoff**:

   ```powershell
   cd backend; python -m pytest
   cd frontend; npm test; npm run typecheck; npm run lint
   ```

6. **Manual smoke**: register → create ticket → reply as staff → change status →
   check notifications ([SETUP_GUIDE.md](SETUP_GUIDE.md#5-first-run--smoke-checklist)).

## Where to change what (common tasks)

| Task | Backend | Frontend |
|---|---|---|
| New enum value / status | `app/models/enums.py` (+ transition map) | `types/ticket.ts`, `lib/constants.ts` label/color, badge tests |
| New field on tickets | `models/ticket.py` (+ service serialize) | `types/ticket.ts`, form/table components |
| New endpoint | `api/v1/<domain>.py` router + service + tests | `services/<domain>.ts` + `types/` + page |
| New notification event | `services/notifications.py` call site | none needed (list UI is generic) |
| New audit action | constant in `services/audit.py` + call site | none (filter is free-text) |
| New env var | `core/config.py` + `.env.example` + docs | `lib/` usage + `.env.example` |

## Things not to do

- Don't add "temporary" mock data to the frontend — the product's guarantee is that
  every screen reflects real API state.
- Don't trust client-provided identity fields (`requester_id`, `role`,
  `is_active`) — derive from the token/database.
- Don't expose an endpoint you haven't tested; don't document one that doesn't exist
  (docs are validated against OpenAPI).
- Don't weaken a test to make it pass — fix the cause (see
  [TESTING.md](TESTING.md)).

## Reference documentation map

| Need | Document |
|---|---|
| Endpoint reference | [API_DOCUMENTATION.md](API_DOCUMENTATION.md) |
| Data model / indexes | [DATABASE.md](DATABASE.md), [DATABASE_INDEXES.md](DATABASE_INDEXES.md) |
| Roles & rules | [USER_ROLES_AND_PERMISSIONS.md](USER_ROLES_AND_PERMISSIONS.md), [TICKET_WORKFLOW.md](TICKET_WORKFLOW.md) |
| Auth internals & limits | [AUTHENTICATION_AND_AUTHORIZATION.md](AUTHENTICATION_AND_AUTHORIZATION.md), [SECURITY.md](SECURITY.md) |
| Env vars | [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) |
| Testing | [TESTING.md](TESTING.md) |
| What's next | [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md) |
