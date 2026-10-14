# DeskFlow — Ticket Management System (Frontend)

A conventional helpdesk/support ticketing frontend built with **Next.js 15 (App Router)**,
**React 19**, **TypeScript (strict)**, and **Tailwind CSS v4**. Customers submit and track
tickets, agents work a queue, and administrators manage users, categories, analytics, and
audit logs. There are **no AI/LLM features** — this is an ordinary support product.

> This frontend talks to the FastAPI + MongoDB backend in [`../backend`](../backend/README.md)
> over REST. It contains **no mock data**: every screen loads from the API and shows
> explicit loading / error / empty states when the backend is unavailable.
> Full project documentation lives in [`../docs/`](../docs/README.md).

---

## 1. Requirements

- **Node.js 20+** (tested on Node 24) — download from <https://nodejs.org>
- **npm 10+** (ships with Node)
- The **backend** running at `http://localhost:8000` (see §6)

Windows note: all commands below are for **PowerShell** or **Git Bash**.

## 2. Setup

```powershell
cd frontend
npm install
copy .env.example .env.local      # PowerShell; use `cp` on Git Bash
npm run dev
```

Open <http://localhost:3000>.

## 3. Scripts

| Command             | What it does                                  |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Start the dev server (Turbopack)              |
| `npm run build`     | Production build                              |
| `npm run start`     | Serve the production build                    |
| `npm run lint`      | ESLint                                        |
| `npm run typecheck` | TypeScript strict check (no emit)             |
| `npm test`          | Vitest unit/component tests (single run)      |
| `npm run test:watch`| Vitest in watch mode                          |

## 4. Environment variables

`.env.local` (copy from `.env.example`):

| Variable                  | Default                        | Purpose                        |
| ------------------------- | ------------------------------ | ------------------------------ |
| `NEXT_PUBLIC_API_BASE_URL`| `http://localhost:8000/api/v1` | FastAPI base URL (with prefix) |

Only this variable exists, and it is public by design (`NEXT_PUBLIC_`): it is just the API
origin. **No secrets are ever stored in this app** — passwords go straight to the backend
over the wire and are never persisted.

## 5. Authentication strategy

- `POST /auth/login` / `POST /auth/register` return a **JWT access token**.
- The token is persisted in `localStorage` under `tms.access_token` (only the token —
  never passwords or profile data) and attached as `Authorization: Bearer <token>` on
  every request.
- On a **401** from any non-auth endpoint, the token is cleared and the user is redirected
  to `/login?next=<original path>`; after signing in they return to where they were.
- **403** responses render friendly access-denied states — frontend role checks only
  shape navigation; **the backend is authoritative**.
- Network failures, timeouts (15 s), and 5xx errors are normalized into user-readable
  messages with retry actions.

If the backend later switches to httpOnly cookies, change only `lib/token.ts` and the
request interceptor in `lib/api-client.ts`.

## 6. Backend connection

The FastAPI + MongoDB backend **lives in `../backend`** (see its
[README](../backend/README.md) and the full docs set in [`../docs/`](../docs/README.md)).

1. Start it from `backend/`: `python -m uvicorn app.main:app --reload` →
   `http://localhost:8000`, CORS already allowing `http://localhost:3000` by default.
2. Seed an admin (needed for the admin pages):
   `python scripts/create_admin.py --email admin@example.com --name "Admin"`.
3. Ensure `.env.local` points `NEXT_PUBLIC_API_BASE_URL` at `<backend>/api/v1`.
4. Restart `npm run dev` after changing env files (they are read at build/start).
5. Interactive API docs: `http://localhost:8000/docs`.

### API contract

> The endpoints below are **implemented and verified** against the backend's live
> OpenAPI schema (`/docs`, `/openapi.json`) — the authoritative reference is
> [`../docs/API_DOCUMENTATION.md`](../docs/API_DOCUMENTATION.md). `types/` +
> `services/` are the single place the contract lives in this app.
> Field names use snake_case to match the Pydantic defaults.

**Auth**

| Method | Path              | Notes                                                    |
| ------ | ----------------- | -------------------------------------------------------- |
| POST   | `/auth/register`  | `{name,email,password}` → `{access_token,user?}` (role = customer) |
| POST   | `/auth/login`     | `{email,password}` → `{access_token,user?}`              |
| GET    | `/auth/me`        | Current user                                             |
| PATCH  | `/auth/me`        | `{name?,email?}` profile update                          |

**Tickets**

| Method | Path                    | Notes |
| ------ | ----------------------- | ----- |
| GET    | `/tickets`              | Query: `page, page_size, search, status, priority, category_id, assignee_id` (`me`\|`unassigned`\|user id), `sort_by` (`created_at\|updated_at\|priority\|status`), `sort_order` (`asc\|desc`). Role-scoped server-side. |
| POST   | `/tickets`              | `{subject,description,category_id,priority}` |
| GET    | `/tickets/{id}`         | Includes `messages[]` (`visibility: public\|internal`) |
| PATCH  | `/tickets/{id}`         | `{status?,priority?,subject?,description?,category_id?}` |
| POST   | `/tickets/{id}/messages`| `{body, visibility: "public"\|"internal"}` |
| POST   | `/tickets/{id}/assign`  | `{assignee_id: user id \| null}` |

**Categories** — `GET /categories` (`include_inactive=1` for admin), `POST /categories`,
`PATCH /categories/{id}` (admin; deactivation instead of deletion).

**Notifications** — `GET /notifications` (`page,page_size,unread_only`),
`PATCH /notifications/{id}/read`, `POST /notifications/read-all`.

**Users (admin)** — `GET /users` (`page,page_size,search,role`), `PATCH /users/{id}`
(`{role?,is_active?}`).

**Analytics** — `GET /analytics/overview`
(`{total_tickets,open_tickets,resolved_tickets?,unassigned_tickets?,total_users?,total_categories?,by_status[],by_priority[],by_category?,created_trend[]}`),
`GET /analytics/agents` (`[{agent,open_tickets,total_tickets}]`).

**Audit logs (admin)** — `GET /audit-logs` (`page,page_size,action,actor_id,entity_type`).

List responses use the envelope `{items,total,page,page_size,pages}`; the frontend also
tolerates `{data,meta}` and `results` variants (`lib/api-utils.ts`).

**Enums (must match the backend exactly):**

- Status: `open`, `in_progress`, `pending`, `resolved`, `closed`
- Priority: `low`, `medium`, `high`, `urgent`
- Message visibility: `public`, `internal`
- Role: `customer`, `agent`, `admin`

**Intentionally not implemented in the UI** (the backend has no such endpoints — no fake buttons):
password recovery/reset, password change, attachment upload/download.
See [`../docs/FILE_ATTACHMENTS.md`](../docs/FILE_ATTACHMENTS.md) for the attachment
status and the security/roles reference in
[`../docs/USER_ROLES_AND_PERMISSIONS.md`](../docs/USER_ROLES_AND_PERMISSIONS.md).

## 7. Project structure

```
frontend/
├── app/                  # Routes (App Router)
│   ├── page.tsx          # Public landing page
│   ├── login/ register/  # Auth screens
│   ├── not-found.tsx     # Friendly 404
│   ├── error.tsx         # Global error boundary
│   └── (app)/            # Authenticated area (RequireAuth + shell)
│       ├── dashboard/    # Role-aware dashboard (charts)
│       ├── tickets/      # List (filters/sort/paging), new, [id] details
│       ├── notifications/ profile/
│       └── admin/        # users, categories, audit-logs (admin-only guard)
├── components/
│   ├── ui/               # shadcn-style primitives (button, dialog, table…)
│   ├── layout/           # AppShell, sidebar, header, notification bell, user menu
│   ├── shared/           # PageHeader, states, skeletons, pagination, form fields
│   ├── tickets/          # Badges, filters, table, conversation, reply, actions
│   └── dashboard/        # Stat cards, Recharts analytics
├── contexts/             # AuthProvider, route guards (RequireAuth / RequireRole)
├── hooks/                # useApi (loading/error/retry)
├── lib/                  # Axios client, errors, token, constants, permissions
├── services/             # Typed API modules per domain
└── types/                # API contract types (single source of truth)
```

## 8. Accessibility & UX guarantees

- Status/priority badges always show **icon + text label** — never color alone.
- Labeled form fields with field-level errors, `aria-invalid`, `aria-describedby`.
- Keyboard-visible focus rings; dialogs are Radix (focus trap, Esc, labels).
- Loading = skeletons/spinners, errors = retry states, lists = empty states.
- Animations respect `prefers-reduced-motion`.
- Destructive/consequential actions (close/resolve ticket, deactivate user) confirm first.

## 9. Tests

Vitest + Testing Library cover:

- API error normalization (FastAPI `detail` strings, 422 field arrays, network/timeout).
- Pagination envelope adaptation (`items` and `data/meta` variants).
- Role permission helpers.
- Status/priority badges render text labels for every enum value.
- Login flow: empty-submit validation, invalid email, single-flight submit (button
  disabled while pending), token persistence, redirect on success.

```powershell
npm test
```

## 10. Verifying against a running backend

1. `npm run dev`, sign in as each role (customer / agent / admin).
2. Customer: create a ticket → see it in *My Tickets* → open details → reply.
3. Agent: open the queue → reply → change status → assign to self → add internal note.
4. Admin: check dashboard charts, change a user role (confirm dialog), toggle a
   category, browse audit logs.
5. Stop the backend and reload: pages must show the "backend unreachable" error state
   with a retry — never fake success.
