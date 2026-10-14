# Features

Implementation status for every feature, verified against source code and tests.
**Legend:** ✅ Implemented · ⚠️ Partially implemented · 📋 Planned (not built) · ❌ Not
implemented

Nothing in this table is aspirational: each ✅ maps to working code and passing tests
(see [TESTING.md](TESTING.md)).

## 1. Authentication & accounts

| Feature | Status | Evidence / notes |
|---|---|---|
| Customer self-registration (`POST /auth/register`) | ✅ | Role is hard-coded to `customer`; the `role` field in the request body is rejected (422) |
| Login → JWT access token (`POST /auth/login`) | ✅ | bcrypt verification; identical 401 for wrong email vs wrong password |
| Current user (`GET /auth/me`) + profile update (`PATCH /auth/me`: name, email) | ✅ | Email uniqueness enforced; role/is_active not updatable here |
| Logout (`POST /auth/logout`) | ⚠️ | Stateless: 204 and the client discards the token. No server-side revocation (documented trade-off) |
| Password hashing (bcrypt, 12 rounds, per-hash salt) | ✅ | `backend/app/core/security.py` |
| First-admin seeding CLI (`scripts/create_admin.py`) | ✅ | Prompts for password (no default); promotes existing users on re-run |
| Public admin registration | ❌ | Deliberately absent |
| Password reset / change / email verification | ❌ | No email subsystem exists; frontend has no such buttons |
| Refresh tokens | ❌ | Single long-lived access token only |
| Auth rate limiting (login/register, per IP) | ⚠️ | In-memory sliding window — one process only; deployments need proxy-level limits too |

## 2. Roles & authorization

| Feature | Status | Evidence / notes |
|---|---|---|
| Three roles: customer, agent, admin | ✅ | Single enum shared by backend models and frontend types |
| Server-side enforcement on every endpoint | ✅ | `get_current_user` / `require_agent` / `require_admin` dependencies; covered by tests asserting 401/403/404 |
| Customer ticket isolation | ✅ | Foreign tickets answer **404** (no existence leak), not 403 |
| Admin lockout guard (cannot demote/deactivate own account) | ✅ | 400 with explicit message; tested |
| Frontend route guards (`RequireAuth`, `RequireRole`) | ✅ | Navigation shaping only — backend remains authoritative |

## 3. Tickets

| Feature | Status | Evidence / notes |
|---|---|---|
| Create ticket (subject, description, category, priority; requester = caller) | ✅ | Human-readable `ticket_number` from a `counters` document |
| List with pagination, filters (`status`, `priority`, `category_id`, `assignee_id`=`me`/`unassigned`, `requester_id`=`me`), search, sorting | ✅ | Sort whitelist enforced (422 on `sort_by=password_hash`) |
| Detail with conversation (`GET /tickets/{id}`) | ✅ | Messages in chronological order |
| Update fields & status (`PATCH /tickets/{id}`) | ✅ | Customers blocked from status changes (403) and from editing resolved/closed tickets (400) |
| Validated status state machine | ✅ | Invalid jumps (e.g. `closed → pending`) return 400; see [TICKET_WORKFLOW.md](TICKET_WORKFLOW.md) |
| Assignment (`POST /tickets/{id}/assign`, incl. unassign via `null`) | ✅ | Agents/admins only (403 for customers); assignee must be an active agent/admin (400) |
| Agent queue visibility (own + assigned + unassigned) | ✅ | Tested: tickets assigned to *other* agents are invisible |
| Attachments on tickets | ❌ | See [FILE_ATTACHMENTS.md](FILE_ATTACHMENTS.md) |

## 4. Messages

| Feature | Status | Evidence / notes |
|---|---|---|
| Public replies by customers and staff | ✅ | Participation enforced; strangers get 404 |
| Internal notes (agent/admin only) | ✅ | Customers receive 403 when attempting; notes never appear in any customer response (tested) |
| Chronological conversation order | ✅ | `created_at` ascending |

## 5. Categories

| Feature | Status | Evidence / notes |
|---|---|---|
| List active categories (for the create-ticket form) | ✅ | Any authenticated role |
| Admin create / update / activate / deactivate | ✅ | Duplicate names → 409 |
| Safe deactivation (existing tickets keep their category) | ✅ | Tested: deactivation does not break ticket history; inactive categories hidden from customers |
| Category deletion | ❌ | Not exposed — deactivation is the supported policy |
| Category usage counts (`GET /categories/{id}/usage`) | ✅ | Admin-only ticket reference count |

## 6. Notifications

| Feature | Status | Evidence / notes |
|---|---|---|
| In-app notifications for: new ticket (to staff pool), assignment, public reply, status change | ✅ | Created server-side in `notifications` collection |
| List own notifications with paging + `unread_only` filter + `unread_count` | ✅ | Ownership enforced — foreign ids answer 404 |
| Mark one read / mark all read | ✅ | Tested |
| Email/push delivery | ❌ | In-app only |

## 7. Analytics

| Feature | Status | Evidence / notes |
|---|---|---|
| Role-scoped overview (totals, by status/priority/category, 14-day creation trend) | ✅ | Customers see only their own tickets; admins get system-wide + user/category counts + unassigned |
| Admin agent-workload report (`GET /analytics/agents`) | ✅ | 403 for non-admins |
| First-response-time metric | ❌ | Frontend type has an optional field for it; the backend never populates it (shows as absent) |

## 8. Administration

| Feature | Status | Evidence / notes |
|---|---|---|
| User management (list/search/role filter, get, change role/activate/deactivate) | ✅ | Admin-only (403 otherwise); `password_hash` never serialized |
| Audit logs (auth events, ticket lifecycle, assignment, category/user admin) | ✅ | Admin-only, filterable by action/actor/entity; no passwords/tokens/message bodies recorded |
| Health/readiness endpoint (`GET /api/v1/health`) | ✅ | Ping-based; no sensitive diagnostics; 503 when DB is down |

## 9. Platform qualities

| Feature | Status | Evidence / notes |
|---|---|---|
| Idempotent index creation at startup | ✅ | `backend/app/db/mongo.py`; documented in [DATABASE_INDEXES.md](DATABASE_INDEXES.md) |
| Fail-fast startup (missing/placeholder `JWT_SECRET`, unreachable MongoDB) | ✅ | Clear startup error; tested implicitly via live boot |
| Centralized error handling (no stack traces to clients) | ✅ | `backend/app/core/errors.py`; 500s log server-side only |
| CORS via environment configuration | ✅ | `CORS_ORIGINS` |
| Frontend loading / error / empty states everywhere | ✅ | `useApi` hook + shared state components |
| Accessibility basics (labels, focus rings, non-color-only badges, reduced motion) | ✅ | Documented and implemented in components |

## 10. Testing

| Feature | Status | Evidence / notes |
|---|---|---|
| Backend pytest suite (auth, permissions, lifecycle, privacy, admin, health, OpenAPI) | ✅ | 96 tests, isolated test DB, auto-skip when MongoDB is unreachable |
| Frontend vitest suite (error normalization, pagination adaptation, permissions, badges, login flow) | ✅ | 24 tests |
| CI pipeline | ❌ | No CI configuration exists in the repository |
