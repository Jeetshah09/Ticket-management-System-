# API Documentation

Authoritative reference for the FastAPI backend. Base URL in development:
`http://localhost:8000` — every route below is prefixed with **`/api/v1`**.

The machine-readable version is generated from the code itself: interactive docs at
`http://localhost:8000/docs` (Swagger UI) and the raw schema at
`http://localhost:8000/openapi.json`. The route list in this document was verified
against that schema. If they ever disagree, **the OpenAPI schema wins** — then fix
this file.

## Conventions

| Aspect | Behavior |
|---|---|
| Content type | `application/json` on all request/response bodies |
| Auth | `Authorization: Bearer <JWT>` on every route except the three public ones: `POST /auth/register`, `POST /auth/login`, `GET /health`. Everything else requires a valid token; role-restricted routes are marked **admin only** / **agent/admin only** below. |
| IDs | 24-char lowercase hex strings (Mongo ObjectId). Malformed ids on path params answer **404**; malformed ids inside bodies answer **422**. |
| Pagination | Query `page` (≥1, default 1) and `page_size` (default 20; max 100 for tickets/users/notifications, 200 for categories). List responses use the envelope below. |
| Enums | status `open\|in_progress\|pending\|resolved\|closed` · priority `low\|medium\|high\|urgent` · visibility `public\|internal` · role `customer\|agent\|admin` |
| Timestamps | ISO-8601 UTC strings, e.g. `"2026-10-13T09:20:00Z"` |

### List envelope

```json
{
  "items": [ /* … */ ],
  "total": 57,
  "page": 1,
  "page_size": 20,
  "pages": 3
}
```

`GET /notifications` returns this envelope **plus** `"unread_count": 4`.

### Error responses

All errors use FastAPI's standard shape; the frontend normalizes all three variants:

```json
{ "detail": "Human-readable message." }
```

```json
{ "detail": [ { "loc": ["body", "subject"], "msg": "String should have at least 1 character.", "type": "string_too_short" } ] }
```
(422 validation — `loc` starts with `body` or `query`.)

```json
{ "detail": { "field": "message" } }
```

**Status code semantics**

| Code | Meaning |
|---|---|
| 200 / 201 / 204 | Success (created / no content) |
| 400 | Well-formed request that violates a business rule (invalid transition, inactive category, non-staff assignee, self-lockout guard) |
| 401 | Missing, invalid, expired or tampered token; also wrong email/password on login |
| 402 | — (never used) |
| 403 | Authenticated but not allowed (wrong role, deactivated account, customer attempting status change / internal note) |
| 404 | Resource missing **or invisible to you** (intentional: no existence leak) |
| 409 | Duplicate email / duplicate category name |
| 422 | Request validation failed (bad types, empty strings, bad enum, non-whitelisted sort field, unknown body fields — bodies are `extra=forbid`) |
| 429 | Auth rate limit tripped (login/register, in-memory, per IP) |
| 500 | Unexpected server error — detail is always the generic `"Internal server error."` |
| 503 | Health check: MongoDB unreachable |

---

## Authentication & profile

### POST `/auth/register` — public
Register a new **customer** account. The `role` field is *not* accepted (unknown body
fields are rejected with 422); role is always `customer`.

Request:
```json
{ "name": "Alice Nguyen", "email": "alice@example.com", "password": "Password123!" }
```
Constraints: `name` 1–120 chars; `email` valid and normalized to lowercase;
`password` 8–72 chars.

Response **201**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…",
  "token_type": "bearer",
  "user": { "id": "65f0…ef1", "name": "Alice Nguyen", "email": "alice@example.com",
            "role": "customer", "is_active": true,
            "created_at": "2026-10-13T09:15:22Z", "updated_at": "2026-10-13T09:15:22Z" }
}
```
Errors: **409** email already registered · **422** validation · **429** rate limited.

### POST `/auth/login` — public
Request: `{ "email": "alice@example.com", "password": "Password123!" }`  
Response **200**: same `AuthResponse` shape as register.  
Errors: **401** invalid credentials (identical message for unknown email and wrong
password — no account enumeration) · **403** account deactivated · **422** · **429**.

### POST `/auth/logout` — auth
Stateless: returns **204** with no body. The client discards its token; the server
does not track sessions. See
[AUTHENTICATION_AND_AUTHORIZATION.md](AUTHENTICATION_AND_AUTHORIZATION.md) for the
implications.

### GET `/auth/me` — auth
Response **200**: the `UserOut` object above.  
Errors: **401** (no/invalid token) · **403** (account deactivated since token issue).

### PATCH `/auth/me` — auth
Update own profile fields only. Request (any subset): `{ "name": "Alice A.",
"email": "new@example.com" }` — `role`/`is_active` are rejected (422, unknown field).  
Response **200**: updated `UserOut`. Errors: **409** new email taken · **422**.

---

## Tickets

### GET `/tickets` — auth · role-scoped
Returns tickets the caller may see: customers → own; agents → own + assigned +
**unassigned queue**; admins → all.

| Query param | Type | Notes |
|---|---|---|
| `page`, `page_size` | int | defaults 1 / 20; `page_size` ≤ 100 |
| `search` | string ≤200 | substring (case-insensitive) on subject/description; exact match on ticket number if numeric |
| `status`, `priority` | enum | single value each |
| `category_id` | hex id | |
| `assignee_id` | string | hex id, or `"me"`, or `"unassigned"` |
| `requester_id` | string | hex id, or `"me"` |
| `sort_by` | `created_at\|updated_at\|priority\|status` | default `updated_at`; anything else → 422 |
| `sort_order` | `asc\|desc` | default `desc` |

Response **200**: `Page[TicketOut]` (see envelope). Errors: **401**, **422**.

### POST `/tickets` — auth
Request:
```json
{ "subject": "VPN fails after password reset",
  "description": "Cannot connect since this morning…",
  "category_id": "65f0…ef3", "priority": "high" }
```
The requester is **always** the authenticated user (never from the body).  
Response **201**: `TicketOut`:
```json
{
  "id": "65f0…ef2", "ticket_number": 42,
  "subject": "VPN fails after password reset", "description": "Cannot connect since this morning…",
  "status": "open", "priority": "high",
  "category": { "id": "65f0…ef3", "name": "Network & VPN", "description": "…", "is_active": true },
  "category_id": "65f0…ef3",
  "requester": { "id": "65f0…ef1", "name": "Alice Nguyen", "email": "alice@example.com", "role": "customer" },
  "assignee": null,
  "created_at": "2026-10-13T09:20:00Z", "updated_at": "2026-10-13T09:20:00Z",
  "message_count": 0
}
```
Errors: **400** category exists but is inactive · **401** · **404** category id not
found · **422**.

### GET `/tickets/{ticket_id}` — auth · visibility-checked
Response **200** — conversation envelope:
```json
{
  "ticket": { /* TicketOut */ },
  "messages": [
    { "id": "65f0…ef5", "ticket_id": "65f0…ef2",
      "author": { "id": "65f0…ef4", "name": "Ben Agent", "email": "ben@example.com", "role": "agent" },
      "body": "Could you try reconnecting the VPN profile?",
      "visibility": "public", "created_at": "2026-10-13T10:02:11Z" }
  ]
}
```
Messages are chronological (oldest first). **Internal notes are stripped from this
response for customers** (they are never serialized to them at all).  
Errors: **401** · **404** missing or not visible to you.

### PATCH `/tickets/{ticket_id}` — auth
Request (any subset): `{ "subject"?, "description"?, "priority"?, "category_id"?,
"status"? }` — at least one field required (422 otherwise).

Per-role rules:
- **Customer** (own ticket, only while status ∈ open/in_progress/pending): may change
  subject/description/priority/category; `status` in the body → **403**; editing a
  resolved/closed ticket → **400**.
- **Agent/Admin**: all fields; status must be a legal transition or **400**.

Response **200**: updated `TicketOut`.  
Errors: **400** illegal transition (e.g. `closed → pending`) or customer edit of a
closed ticket · **403** · **404** · **422**.

### POST `/tickets/{ticket_id}/messages` — auth
Request: `{ "body": "Any updates?", "visibility": "public" }` (`visibility` defaults
to `public`; `internal` allowed for agent/admin only).  
Response **201**: the full conversation envelope (same shape as
`GET /tickets/{ticket_id}`).  
Errors: **403** customer attempting `internal` · **404** not visible · **422**
(empty/whitespace body).

### POST `/tickets/{ticket_id}/assign` — **agent/admin only**
Request: `{ "assignee_id": "65f0…ef4" }` or `{ "assignee_id": null }` to unassign.  
Response **200**: updated `TicketOut`.  
Errors: **403** customer · **404** ticket not visible · **400** assignee is not an
active agent/admin · **422**.

---

## Categories

### GET `/categories` — auth
Active categories only, sorted by name. Admins may pass `include_inactive=1` to see
all. Query: `include_inactive`, `page`, `page_size` (≤200, default 100).  
Response **200**: `Page[CategoryOut]` where
`CategoryOut = { id, name, description, is_active, created_at, updated_at }`.

### POST `/categories` — **admin only**
Request: `{ "name": "Network & VPN", "description": "Connectivity issues",
"is_active": true }` → **201** `CategoryOut`.  
Errors: **403** · **409** name exists · **422**.

### PATCH `/categories/{category_id}` — **admin only**
Request (any subset): `{ "name"?, "description"?, "is_active"? }` → **200**
`CategoryOut`. Deactivating keeps existing ticket references intact (by design — see
[TICKET_WORKFLOW.md](TICKET_WORKFLOW.md)).  
Errors: **403** · **404** · **409** name conflict · **422**.

### GET `/categories/{category_id}/usage` — **admin only**
Response **200**: `{ "category_id": "65f0…ef3", "ticket_count": 12 }` — lets an admin
see how many tickets reference a category before deactivating it.

---

## Notifications

All notification routes are scoped to the authenticated user; another user's
notification id answers **404** (never 403 — no existence leak).

### GET `/notifications` — auth
Query: `page`, `page_size` (≤100), `unread_only` (boolean, send `1`).  
Response **200** (envelope + unread counter):
```json
{
  "items": [
    { "id": "65f0…ef6", "title": "New reply on ticket #42",
      "body": "Could you try reconnecting the VPN profile?",
      "ticket_id": "65f0…ef2", "is_read": false,
      "created_at": "2026-10-13T10:02:11Z" }
  ],
  "total": 5, "page": 1, "page_size": 20, "pages": 1, "unread_count": 3
}
```

### PATCH `/notifications/{notification_id}/read` — auth
Response **200**: the notification with `is_read: true` (idempotent). Errors: **404**.

### POST `/notifications/read-all` — auth
Response **200**: `{ "marked": 3 }` (count of newly marked items).

---

## Analytics

### GET `/analytics/overview` — auth · role-scoped
Response **200**:
```json
{
  "total_tickets": 57, "open_tickets": 21, "resolved_tickets": 30,
  "unassigned_tickets": 4, "total_users": 12, "total_categories": 6,
  "by_status":    [ { "key": "open", "label": "Open", "count": 12 }, … ],
  "by_priority":  [ { "key": "urgent", "label": "Urgent", "count": 3 }, … ],
  "by_category":  [ { "key": "Network & VPN", "label": "Network & VPN", "count": 9 }, … ],
  "created_trend": [ { "date": "2026-10-13", "count": 4 }, /* last 14 days, zero-filled */ ]
}
```
Scoping: customers/agents see aggregates of **only the tickets they can see**;
`unassigned_tickets`, `total_users` and `total_categories` are populated for admins
only (omitted/null otherwise). The frontend tolerates their absence.

### GET `/analytics/agents` — **admin only**
Response **200**: a JSON **array** (not an envelope):
```json
[ { "agent": { "id": "65f0…ef4", "name": "Ben Agent", "email": "ben@example.com", "role": "agent" },
    "open_tickets": 5, "total_tickets": 18 } ]
```
Errors: **403** for non-admins.

---

## Users (admin)

### GET `/users` — **admin only**
Query: `page`, `page_size` (≤100), `search` (case-insensitive substring on
name/email), `role` (enum). Response **200**: `Page[UserOut]`. `password_hash` is
never included. Errors: **403**.

### GET `/users/{user_id}` — **admin only**
Response **200** `UserOut` · **404** unknown id · **403**.

### PATCH `/users/{user_id}` — **admin only**
Request (any subset): `{ "role": "agent" }`, `{ "is_active": false }` — at least one
required (422).  
**Lockout guard:** an admin cannot change their *own* role or deactivate their *own*
account → **400** with an explicit message.  
Response **200** `UserOut`. Errors: **400** guard / **403** / **404** / **422**.
Deactivated users cannot log in, and their existing tokens are rejected (403) on the
next authenticated call.

---

## Audit logs

### GET `/audit-logs` — **admin only**
Query: `page`, `page_size` (≤100), `action` (prefix match, e.g. `ticket.` matches
`ticket.created`), `actor_id` (hex), `entity_type`.  
Response **200**: `Page[AuditLogOut]`:
```json
{
  "items": [
    { "id": "65f0…ef7", "action": "ticket.status_changed",
      "actor": { "id": "65f0…ef4", "name": "Ben Agent", "email": "ben@example.com", "role": "agent" },
      "entity_type": "ticket", "entity_id": "65f0…ef2",
      "details": "open -> in_progress", "ip_address": "127.0.0.1",
      "created_at": "2026-10-13T10:00:00Z" }
  ],
  "total": 214, "page": 1, "page_size": 20, "pages": 11
}
```
Passwords, tokens and message bodies never appear in entries. Errors: **401**/**403**.

---

## Health

### GET `/health` — public
Response **200**: `{ "status": "ok", "database": "ok" }` when MongoDB answers a ping.  
Response **503**: `{ "status": "degraded", "database": "unavailable" }` otherwise —
no URI, host, or stack details are exposed.

---

## Not implemented (no such routes exist)

The following are **absent by design** in v1 — do not document or call them as
implemented:

- Attachments/upload/download of any kind
- Password reset / change / refresh-token endpoints
- Ticket or user **deletion** endpoints
- Webhooks, SSE/WebSocket real-time endpoints
- Any AI/LLM endpoints

A test (`test_no_attachment_routes_advertised`) asserts the OpenAPI schema contains
no attachment/upload paths.
