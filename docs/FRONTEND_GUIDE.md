# Frontend Guide

Code-level guide to `frontend/`. For setup commands see
[SETUP_GUIDE.md](SETUP_GUIDE.md); for the general picture,
[ARCHITECTURE.md](ARCHITECTURE.md#frontend-structure--data-flow).

Stack: **Next.js 15.5** (App Router, Turbopack) · **React 19** · **TypeScript
(strict)** · **Tailwind CSS v4** · Radix UI primitives (shadcn-style) ·
react-hook-form + zod · axios · Recharts · sonner (toasts) · date-fns · framer-motion.
Tests: **Vitest + Testing Library** (jsdom).

## Routes

| Route | Page file | Access |
|---|---|---|
| `/` | `app/page.tsx` | public landing |
| `/login`, `/register` | `app/login/page.tsx`, `app/register/page.tsx` | public |
| `/dashboard` | `app/(app)/dashboard/page.tsx` | authenticated, role-aware |
| `/tickets` | `app/(app)/tickets/page.tsx` | authenticated (server-side scoping decides content) |
| `/tickets/new` | `app/(app)/tickets/new/page.tsx` | authenticated (nav shows it to customers) |
| `/tickets/[id]` | `app/(app)/tickets/[id]/page.tsx` | authenticated + visibility |
| `/notifications` | `app/(app)/notifications/page.tsx` | authenticated |
| `/profile` | `app/(app)/profile/page.tsx` | authenticated |
| `/admin/users`, `/admin/categories`, `/admin/audit-logs` | `app/(app)/admin/*/page.tsx` | admin (`RequireRole`) |
| 404 / error boundary | `app/not-found.tsx`, `app/error.tsx` | — |

The `(app)` route group wraps everything in `RequireAuth` + `AppShell`
(sidebar + header); `admin/layout.tsx` adds `RequireRole(["admin"])`.

## Directory map

```
frontend/
├── app/                  # Routes (App Router) — see table above
├── components/
│   ├── ui/               # Primitives: button, badge, card, dialog, select, table…
│   ├── layout/           # AppShell, sidebar (nav-config), notification bell, user menu
│   ├── shared/           # PageHeader, ErrorState, EmptyState, skeletons, pagination,
│   │                     # form-field, FadeIn, AccessDenied, FullPageLoader
│   ├── tickets/          # ticket-list-table, ticket-filters, ticket-badges,
│   │                     # conversation, reply-form, ticket-actions
│   └── dashboard/        # stat-card, charts (Recharts: status/priority/trend/workload)
├── contexts/             # auth-context (session), route-guards (RequireAuth/RequireRole)
├── hooks/use-api.ts      # useApi: loading / error / retry fetch hook
├── lib/                  # api-client (axios), api-error (normalization), api-utils
│                         # (pagination adaptation), token (localStorage), constants
│                         # (labels/colors), permissions (role helpers), utils
├── services/             # One typed module per domain: auth, tickets, categories,
│                         # notifications, users, analytics, audit-logs (+ index barrel)
└── types/                # API contract types — the single source of truth for shapes
```

## Data flow

```
page/component
  → useApi(() => tickets.listTickets({...}), [deps])     # loading/error/retry state
    → services/tickets.ts                                # typed API function
      → lib/api-client.ts (axios: Bearer token, 15s timeout, 401→login redirect)
        → lib/api-error.ts (toApiError: every failure → ApiError{message, fieldErrors})
```

Rules of thumb used throughout:

1. **Never fabricate data.** Every number on screen comes from the API; failures show
   an `ErrorState` with a retry button.
2. **Each data region loads independently** — one failing panel doesn't blank a page.
3. **Adapters live in one place**: `lib/api-utils.ts::toPaginated` accepts the
   canonical `{items,total,page,page_size,pages}` envelope *and* legacy
   `{data,meta}`/`results` variants; `services/auth.ts::resolveSession` tolerates
   token-only login responses. These are shape adaptations, not fake data.

## Contract & enums

- Types in `types/` mirror the Pydantic schemas exactly (snake_case fields). When the
  backend changes, update `types/` first, then services/components.
- Enum **values** live in `types/ticket.ts` (`TICKET_STATUSES`, `TICKET_PRIORITIES`,
  `MESSAGE_VISIBILITIES`) and `types/auth.ts` (`Role`); display **labels/colors** live
  in `lib/constants.ts` (`STATUS_META`, `PRIORITY_META`, `ROLE_META`). Both must
  match the backend enums — see
  [API_DOCUMENTATION.md](API_DOCUMENTATION.md#conventions).

## Auth handling

- `contexts/auth-context.tsx` owns the session: on mount it calls `GET /auth/me` if a
  token exists; exposes `login`, `register`, `logout`, `refresh`, `setUser`.
- `lib/token.ts` stores **only** the JWT under `tms.access_token` (localStorage,
  SSR-safe reads). Never store profile data or passwords client-side.
- 401 from a non-auth endpoint → token cleared + redirect to `/login?next=…`
  (interceptor in `lib/api-client.ts`); parallel 401s don't stack redirects.
- Backend unreachability during session resolve → treated as signed out **with** an
  explanatory `sessionError` so pages can show a connection problem rather than a
  bare login screen.

## Forms & validation

- react-hook-form + zod resolvers for login/register/new-ticket/reply/profile forms.
- Server 422 field errors are mapped onto fields via
  `lib/api-error.ts::applyFieldErrors` (uses the FastAPI `detail[].loc` array).
- Inputs have labels, `aria-invalid`, and error text wired via `aria-describedby`.

## UI conventions

- Status/priority/role are shown with **icon + text label** (never color alone) via
  `ticket-badges.tsx` and `STATUS_META` etc.
- Loading = skeleton components (`shared/skeletons.tsx`), errors =
  `ErrorState` + retry, empty lists = `EmptyState` with a call to action.
- Consequential actions (resolve/close ticket, deactivate user, mark-all-read) confirm
  first (Radix `Dialog`) and use `sonner` toasts for outcomes.
- Animations respect `prefers-reduced-motion`; `FadeIn` is the shared entrance.
- Responsive: `AppShell` collapses the sidebar on small screens.

## Frontend tests (Vitest)

Config: `vitest.config.mts` (jsdom, `@` alias, globals, setup in `vitest.setup.ts`).
Existing suites:

| File | Covers |
|---|---|
| `lib/api-error.test.ts` | FastAPI `detail` string / 422 array / field-map parsing, network & timeout messages |
| `lib/api-utils.test.ts` | Pagination envelope adaptation |
| `lib/permissions.test.ts` | Role helper logic |
| `components/tickets/ticket-badges.test.tsx` | Every enum value renders a text label |
| `app/login/page.test.tsx` | Empty-submit errors, invalid email, single-flight submit, token persistence, navigation |

```powershell
npm test           # single run
npm run test:watch # watch mode
```

There is **no E2E/browser test suite** (no Playwright/Cypress) — see
[TESTING.md](TESTING.md#known-gaps).

## Conventions for new code

1. New API surface → add types first (`types/`), then a service function, then use
   `useApi` in the component.
2. Keep server authorization authoritative: use `lib/permissions.ts` only to shape
   the UI, never to skip a call you "know will fail".
3. Reuse `components/ui` primitives before adding new ones; keep Radix-based a11y
   behaviors (focus trap, Esc).
4. No direct `fetch`/axios outside `services/` — everything goes through
   `lib/api-client.ts` so token and error handling stay consistent.
5. Run `npm run typecheck && npm run lint && npm test` before handing off.
