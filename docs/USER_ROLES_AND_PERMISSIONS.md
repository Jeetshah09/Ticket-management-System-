# User Roles and Permissions

Three roles exist: **customer**, **agent**, **admin**. Every cell below reflects
**backend enforcement** (verified by tests); the frontend merely hides or shows
controls to match. A hidden button is never the security boundary.

Legend: ✅ allowed · ❌ denied (403, or 404 when visibility hides the object) · —
not applicable

## Capability matrix

| Capability | Customer | Agent | Admin |
|---|---|---|---|
| Register via public signup | ✅ | ✅ (open) | ✅ (needs `ADMIN_INVITE_CODE`) |
| Log in / read + edit own profile (name, email) | ✅ | ✅ | ✅ |
| Create tickets | ✅ | ✅ | ✅ |
| View tickets | own only | own + assigned + **unassigned queue** | all |
| Edit subject/description/priority/category | own, while status ∈ open/in_progress/pending | visible tickets | all |
| Edit resolved/closed tickets | ❌ (400) | ✅ | ✅ |
| Change ticket **status** | ❌ (403) | ✅ (valid transitions only) | ✅ (valid transitions only) |
| Post **public replies** | own tickets | visible tickets | all |
| Post **internal notes** | ❌ (403) | ✅ | ✅ |
| Read internal notes | ❌ (stripped from every response) | ✅ | ✅ |
| Assign / unassign | ❌ (403) | ✅ (assignee must be active agent/admin) | ✅ |
| List categories (active) | ✅ | ✅ | ✅ |
| List categories incl. inactive | ❌ (filtered) | ❌ (filtered) | ✅ (`include_inactive=1`) |
| Create/update/activate/deactivate categories | ❌ (403) | ❌ (403) | ✅ |
| View own notifications / mark read | ✅ | ✅ | ✅ |
| View **others'** notifications | ❌ (404) | ❌ (404) | ❌ (404) |
| Analytics overview | own tickets only | visible tickets only | system-wide + user/category counts + unassigned |
| Per-agent workload report | ❌ (403) | ❌ (403) | ✅ |
| List/get/update users (role, is_active) | ❌ (403) | ❌ (403) | ✅ |
| Change own role / deactivate own account | — | — | ❌ (400, lockout guard) |
| Read audit logs | ❌ (403) | ❌ (403) | ✅ |
| Upload/download attachments | ❌ | ❌ | ❌ (feature not implemented) |

## How each layer enforces this

1. **Token → user** (`app/dependencies/auth.py::get_current_user`): every protected
   route resolves the bearer token to a *fresh* user document. Deactivated accounts →
   403; bad/absent tokens → 401.
2. **Role gates**: `require_agent` (agent+admin) guards assignment;
   `require_admin` guards users, category mutation, `analytics/agents`, `audit-logs`.
3. **Object-level rules** (`app/services/tickets.py`, routers):
   - Ticket visibility: customer → `requester_id == self`; agent → requester, self as
     assignee, or unassigned; admin → all. Invisible tickets answer **404**.
   - Customer edit window: only while status is open/in_progress/pending; a `status`
     field in a customer's PATCH → 403.
   - Internal notes: `visibility: "internal"` rejected for customers (403), and the
     message query filters `visibility: "public"` whenever the viewer is a customer —
     notes are *never serialized* to them.
   - Assignment: assignee must be an active user whose role is agent/admin (400).
   - Notifications and audit rows are always queried with the caller's id (or an
     admin gate), so foreign ids return 404.

## Provisioning rules

- **Customers** self-register.
- **Agents** are created by an admin changing a user's role
  (`PATCH /users/{id}` `{"role": "agent"}`).
- **Admins** are seeded only via `backend/scripts/create_admin.py` (interactive
  password, no default) or promoted by another admin. There is intentionally **no
  public admin registration**.

## Frontend mapping

| UI area | Guard | Backend counterpart |
|---|---|---|
| `(app)/*` (dashboard, tickets, notifications, profile) | `RequireAuth` | 401 handling |
| `/admin/users`, `/admin/categories`, `/admin/audit-logs` | `RequireRole(["admin"])` | 403 from the API |
| Nav: "New Ticket" shown to customers; "Ticket Queue" to staff (`nav-config.ts`) | role label | role-scoped `GET /tickets` |
| Ticket actions panel (status select, assignee picker) | `canManageTicket(user)` | 403 on PATCH/assign |
| Reply form "internal note" option | `canAddInternalNote(user)` | 403 on messages |
| Admin-only picker listing agents for assignment | `isAdmin(user)` | `GET /users?role=agent` (403 for others) |

## Testing evidence

- `backend/tests/test_tickets.py` — customer isolation (404), status change 403,
  assignment 403/400, agent queue scoping, transition 400s.
- `backend/tests/test_messages.py` — internal-note 403 for customers; notes absent
  from every customer-visible response.
- `backend/tests/test_admin.py` — users/categories/audit-logs 403 for non-admins;
  self-demotion/deactivation 400.
- `backend/tests/test_notifications.py` — owner-only (foreign id → 404).
- `frontend/lib/permissions.test.ts` — UI helper parity.
