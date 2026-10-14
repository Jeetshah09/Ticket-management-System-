# Administrator Guide

How to use DeskFlow as an **admin**: staff accounts, categories, system-wide
visibility, and the audit trail. (Customers: [USER_GUIDE.md](USER_GUIDE.md) ·
Agents: [AGENT_GUIDE.md](AGENT_GUIDE.md).)

Admins cannot be created through the web UI. An admin account is produced by the
seeding CLI (below) or by another admin promoting your user.

## Seeding the first admin

There is **no public admin registration**. From the `backend/` directory (with the
virtual environment activated):

```powershell
python scripts/create_admin.py --email admin@example.com --name "Site Admin"
```

- The password is prompted interactively (not echoed, asked twice, **no default**).
  For scripts/CI pass `--password $env:ADMIN_PASSWORD` instead.
- Re-running with an existing email **promotes** that account back to admin (safe to
  re-run; useful if you locked yourself out of the role but not the account).
- Every seeding writes an audit-log entry (`user.created_admin`).

## User management (`/admin/users`)

The Users page lists every account with search (name/email) and a role filter.

| Action | How | Effect |
|---|---|---|
| Promote to agent | row menu → change role | The user immediately gets the agent queue and staff powers |
| Grant admin | change role to Admin | Same, plus this admin area |
| Demote | change role to Customer/Agent | Loses staff powers on their **next request** (roles are re-checked server-side every call — no waiting for token expiry) |
| Deactivate | toggle active off | They can no longer log in and their existing tokens are rejected (403) on next use. Reversible. |
| Reactivate | toggle active on | Normal access restored |

Guard rails (the server enforces these, not just the UI):

- You **cannot deactivate your own account** (400) — lockout protection.
- You **cannot change your own role** (400).
- Passwords are never displayed or editable here; there is **no password-reset
  feature** in this version — for a forgotten password, either have the user
  register a new account or set a new hash directly in the database (documented
  limitation; see [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md)).

## Category management (`/admin/categories`)

- **Create** a category (name unique — duplicates answer 409, description optional).
- **Rename / re-describe** at any time.
- **Deactivate** a category to remove it from the ticket-creation form **without
  breaking history**: existing tickets keep their category reference forever.
  Before deactivating, check **usage** — `GET /api/v1/categories/{id}/usage` shows how
  many tickets reference it (also handy from the API docs page).
- Categories are **never deleted** — deactivation is the supported policy.

## Tickets (everything is visible to you)

Admins see **all** tickets in the queue (not just unassigned/assigned-to-them) and
can do anything an agent can: reply, add internal notes, change status, assign to
any active agent/admin. Use assignment to rebalance workload; the **Dashboard**
shows a per-agent workload chart (open vs total per assignee).

## Analytics (`/dashboard`)

Your dashboard is system-wide, unlike the customer/agent views:

- Totals: all tickets, open, resolved, unassigned; user and category counts.
- Breakdowns: by status, priority, and category; a 14-day creation trend.
- **Agent workload**: open/total per assignee — use it to spot who is saturated or
  idle.

All numbers are computed server-side from real data; nothing is client-side
estimated.

## Audit logs (`/admin/audit-logs`)

A permanent, newest-first record of significant actions. Filter by:

- **Action** — prefix match: `auth.` (register/login/login-failed/profile),
  `ticket.` (created/updated/status_changed/assigned/unassigned/message_added),
  `category.`, `user.`. Example: enter `ticket.` for all ticket events.
- **Actor** — everything one user did (paste their id from the Users page).
- **Entity type** — `ticket` / `user` / `category`.

Each row shows actor (name+role), entity, a short human-readable detail (e.g.
`open -> in_progress`), the IP address when available, and a timestamp.

**What is deliberately NOT in the audit log:** passwords, password hashes, tokens,
and message bodies. Failed logins are recorded (with the attempted email) to help
spot brute-forcing — but never the attempted password.

## Operational notes

- **Health**: `GET /api/v1/health` (or the URL directly) returns
  `{"status":"ok","database":"ok"}`; a 503 with `"degraded"` means MongoDB is
  unreachable — check the backend terminal.
- **Rate limiting**: repeated failed logins from one IP trip a per-minute limit
  (429). It's in-memory (per process); if you run multiple backend instances the
  effective limit multiplies.
- **Data safety**: this version has **no delete endpoints** for users, tickets, or
  categories — deactivation is the only "off" switch. Plan backups accordingly
  ([DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)).
- **CORS**: new frontend origins must be added to `CORS_ORIGINS` in `backend/.env`
  or the browser will block requests.

## Admin capability summary

The full matrix is [USER_ROLES_AND_PERMISSIONS.md](USER_ROLES_AND_PERMISSIONS.md);
highlights: everything an agent can do, plus users, categories, system-wide
analytics, the workload report, and audit logs — while being unable to demote or
deactivate *yourself*.
