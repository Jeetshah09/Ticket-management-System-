# Requirements

Functional (F) and non-functional (NFR) requirements for DeskFlow, with the current
implementation status. "Implemented" means the behavior exists in code and is covered
by tests (see [TESTING.md](TESTING.md)); gaps are called out explicitly.

## Functional requirements

### Authentication & accounts

| ID | Requirement | Status |
|---|---|---|
| F-AUTH-1 | Visitors can register an account with name, email, password. Registration always creates a **customer**; the `role` field is never accepted from the client. | ✅ Implemented |
| F-AUTH-2 | Users can log in with email + password and receive a JWT access token plus their profile. | ✅ Implemented |
| F-AUTH-3 | Passwords are stored only as bcrypt hashes (12 rounds, unique salt). | ✅ Implemented |
| F-AUTH-4 | Email addresses are normalized (trimmed, lowercased) and unique. | ✅ Implemented |
| F-AUTH-5 | Authenticated users can read and update their own name/email. | ✅ Implemented |
| F-AUTH-6 | The first administrator is created through a CLI process that requires an explicit password (no default credentials). | ✅ Implemented (`scripts/create_admin.py`) |
| F-AUTH-7 | Deactivated users cannot log in and their existing tokens are rejected on use. | ✅ Implemented |
| F-AUTH-8 | Failed logins are recorded in the audit log without recording the attempted password. | ✅ Implemented |
| F-AUTH-9 | Password reset/change and email verification. | ❌ Not implemented (no email subsystem) |

### Tickets

| ID | Requirement | Status |
|---|---|---|
| F-TKT-1 | A customer can create a ticket with subject, description, category and priority; the requester is derived from the authenticated user. | ✅ Implemented |
| F-TKT-2 | Tickets receive a human-readable sequential ticket number. | ✅ Implemented (`counters` collection) |
| F-TKT-3 | Ticket lists support pagination, filtering (status, priority, category, assignee incl. `me`/`unassigned`, requester incl. `me`), search over subject/description/ticket number, and whitelisted sorting. | ✅ Implemented |
| F-TKT-4 | List visibility is role-scoped: customers see only their own tickets; agents see their own, assigned, and unassigned (queue) tickets; admins see all. | ✅ Implemented & tested |
| F-TKT-5 | Reading or modifying another customer's ticket is impossible; attempts answer 404 without leaking existence. | ✅ Implemented & tested |
| F-TKT-6 | Field updates (subject, description, priority, category) are allowed per role; customers may not edit resolved/closed tickets. | ✅ Implemented |
| F-TKT-7 | Status changes follow a validated state machine; invalid transitions are rejected with 400. | ✅ Implemented & tested |
| F-TKT-8 | Only agents/admins can change status; customers attempting it receive 403. | ✅ Implemented & tested |
| F-TKT-9 | Only agents/admins can assign/unassign; the assignee must be an active agent or admin. | ✅ Implemented & tested |
| F-TKT-10 | Attachment upload/download on tickets. | ❌ Not implemented (see [FILE_ATTACHMENTS.md](FILE_ATTACHMENTS.md)) |

### Messages

| ID | Requirement | Status |
|---|---|---|
| F-MSG-1 | Authorized participants can post public replies; messages are returned in chronological order. | ✅ Implemented & tested |
| F-MSG-2 | Agents/admins can post internal notes; customers can neither post them nor ever receive them in any response. | ✅ Implemented & tested |
| F-MSG-3 | Non-participants cannot post to a ticket (404). | ✅ Implemented & tested |

### Categories

| ID | Requirement | Status |
|---|---|---|
| F-CAT-1 | Any authenticated user can list active categories (for the create-ticket form). | ✅ Implemented |
| F-CAT-2 | Admins can create, rename, re-describe, activate and deactivate categories; duplicate names are rejected (409). | ✅ Implemented |
| F-CAT-3 | Deactivation never breaks existing tickets — history keeps its category reference; the category disappears from the creation form. | ✅ Implemented & tested |
| F-CAT-4 | Non-admins cannot mutate categories (403). | ✅ Implemented & tested |

### Notifications

| ID | Requirement | Status |
|---|---|---|
| F-NTF-1 | Server creates in-app notifications for: ticket created (staff pool), assignment, public reply, status change. | ✅ Implemented |
| F-NTF-2 | Users list only their own notifications with pagination and an `unread_only` filter, plus an unread counter. | ✅ Implemented & tested |
| F-NTF-3 | Users can mark one notification or all notifications as read; foreign ids answer 404. | ✅ Implemented & tested |
| F-NTF-4 | Email/push delivery. | ❌ Not implemented |

### Analytics & audit

| ID | Requirement | Status |
|---|---|---|
| F-ANA-1 | Authenticated users receive role-scoped aggregate metrics (totals, by status/priority/category, 14-day creation trend); customers only ever see aggregates of their own tickets. | ✅ Implemented & tested |
| F-ANA-2 | Admins additionally receive user/category counts, unassigned totals, and a per-agent workload report. | ✅ Implemented & tested |
| F-AUD-1 | Significant actions (register, login success/failure, profile change, ticket create/update/status/assign, message add, category and user administration) are recorded with actor, entity and timestamp. | ✅ Implemented |
| F-AUD-2 | Audit logs are readable by admins only, filterable by action/actor/entity. | ✅ Implemented & tested |
| F-AUD-3 | Passwords, tokens and message bodies are never written to audit logs. | ✅ Implemented (asserted by tests) |

### Platform

| ID | Requirement | Status |
|---|---|---|
| F-PLT-1 | A health endpoint reports liveness/readiness without exposing diagnostics. | ✅ Implemented (`GET /api/v1/health`, 503 when DB unreachable) |
| F-PLT-2 | Indexes are created idempotently at startup. | ✅ Implemented |

## Non-functional requirements

| ID | Requirement | Status / notes |
|---|---|---|
| NFR-1 | **Security:** all authorization enforced server-side; 401 vs 403 semantics consistent; no secrets in source control; fail-fast on missing `JWT_SECRET`. | ✅ (limits documented in [SECURITY.md](SECURITY.md)) |
| NFR-2 | **Confidentiality of user data:** other users' tickets, notifications and audit logs are inaccessible; `password_hash` never serialized in any response. | ✅ Tested |
| NFR-3 | **Error handling:** consistent JSON error envelope; no stack traces, paths or credentials sent to clients. | ✅ |
| NFR-4 | **Performance:** indexed queries for all list endpoints; pagination caps (`page_size` ≤ 100 tickets/users, ≤ 200 categories). No formal latency budget is measured. | ⚠️ Reasonable defaults; not benchmarked |
| NFR-5 | **Configurability:** MongoDB URI/db, JWT secret/lifetime, CORS origins, auth rate limit all come from environment variables. | ✅ [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) |
| NFR-6 | **Testability:** isolated test database; external services optional (suite skips cleanly without MongoDB). | ✅ |
| NFR-7 | **Portability:** runs on Windows (PowerShell) and POSIX with Python 3.11+ / Node 20+; no OS-specific code. | ✅ Verified on Windows |
| NFR-8 | **Observability:** structured application logging of startup/shutdown and errors; no sensitive data logged. | ⚠️ Basic stdlib logging only |
| NFR-9 | **Rate limiting** on authentication endpoints. | ⚠️ In-memory, single process — see [SECURITY.md](SECURITY.md) |
| NFR-10 | **Accessibility:** labeled inputs, keyboard-operable dialogs, status conveyed by text (not color alone), reduced-motion support. | ✅ Implemented in components |
| NFR-11 | **Real-time updates** (live queue without refresh). | ❌ Not implemented — pages load on demand |
