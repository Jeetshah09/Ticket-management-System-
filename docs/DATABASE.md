# Database

MongoDB, database name **`ticket_management_db`** by default (override with the
`MONGO_DB` environment variable; tests use `ticket_management_db_test`). The driver is
PyMongo's built-in async API (`AsyncMongoClient`, pymongo ≥ 4.11) — see
[BACKEND_GUIDE.md](BACKEND_GUIDE.md#async-approach).

**Conventions**

- Every document has an `_id` of BSON type `ObjectId`. In API responses it is exposed
  as a lowercase 24-char hex string in a field named `id`.
- **Cross-collection references are stored as hex strings, not ObjectIds**
  (`requester_id`, `assignee_id`, `category_id`, `ticket_id`, `user_id`,
  `actor_id`). This keeps serialization trivial and avoids mixed-type queries; joins
  are done in application code (see `app/utils/serialize.py`,
  `app/services/tickets.py`).
- Timestamps are UTC datetimes (`datetime.now(timezone.utc)`).
- Password hashes (bcrypt) live only in `users.password_hash` and are never selected
  into API responses.

There are **no embedded arrays of subdocuments** — conversations are a separate
collection so message counts and pagination stay cheap.

---

## Collections

### `users`

One document per account (customers, agents, admins).

| Field | Type | Required | Notes |
|---|---|---|---|
| `_id` | ObjectId | auto | |
| `name` | string | yes | 1–120 chars, trimmed |
| `email` | string | yes | **unique index**; stored lowercased |
| `password_hash` | string | yes | bcrypt digest (includes salt); never serialized |
| `role` | string | yes | `customer` \| `agent` \| `admin` |
| `is_active` | bool | yes (default `true`) | deactivated users cannot log in; tokens rejected on use |
| `created_at` | datetime | yes | |
| `updated_at` | datetime | yes | |

References **to**: tickets (`requester_id`, `assignee_id`), ticket_messages
(`author_id`), notifications (`user_id`), audit_logs (`actor_id`).

```json
{
  "_id": {"$oid": "65f0abc1234567890abcdef1"},
  "name": "Alice Nguyen",
  "email": "alice@example.com",
  "password_hash": "$2b$12$<salt+digest…>",
  "role": "customer",
  "is_active": true,
  "created_at": {"$date": "2026-10-13T09:15:22.412Z"},
  "updated_at": {"$date": "2026-10-13T09:15:22.412Z"}
}
```

### `tickets`

One document per support request.

| Field | Type | Required | Notes |
|---|---|---|---|
| `_id` | ObjectId | auto | |
| `ticket_number` | int | yes | **unique index**; sequential from `counters` |
| `subject` | string | yes | 1–200 chars |
| `description` | string | yes | 1–10 000 chars |
| `category_id` | string (hex) | yes | → `categories._id` |
| `priority` | string | yes | `low` \| `medium` \| `high` \| `urgent` |
| `status` | string | yes | `open` \| `in_progress` \| `pending` \| `resolved` \| `closed` |
| `requester_id` | string (hex) | yes | → `users._id`; set server-side from the token |
| `assignee_id` | string (hex) \| null | yes (nullable) | → `users._id`; `null` = unassigned |
| `created_at` | datetime | yes | |
| `updated_at` | datetime | yes | bumped on any change incl. new messages |
| `message_count` | int | yes | denormalized count of messages |

```json
{
  "_id": {"$oid": "65f0abc1234567890abcdef2"},
  "ticket_number": 42,
  "subject": "VPN fails after password reset",
  "description": "Cannot connect since this morning…",
  "category_id": "65f0abc1234567890abcdef3",
  "priority": "high",
  "status": "in_progress",
  "requester_id": "65f0abc1234567890abcdef1",
  "assignee_id": "65f0abc1234567890abcdef4",
  "created_at": {"$date": "2026-10-13T09:20:00.000Z"},
  "updated_at": {"$date": "2026-10-13T10:02:11.000Z"},
  "message_count": 3
}
```

### `ticket_messages`

Conversation entries (public replies and internal notes). One document per message.

| Field | Type | Required | Notes |
|---|---|---|---|
| `_id` | ObjectId | auto | |
| `ticket_id` | string (hex) | yes | → `tickets._id` |
| `author_id` | string (hex) | yes | → `users._id` |
| `body` | string | yes | 1–10 000 chars |
| `visibility` | string | yes | `public` \| `internal` (internal = staff only) |
| `created_at` | datetime | yes | ordering key for the conversation |

```json
{
  "_id": {"$oid": "65f0abc1234567890abcdef5"},
  "ticket_id": "65f0abc1234567890abcdef2",
  "author_id": "65f0abc1234567890abcdef4",
  "body": "Could you try reconnecting the VPN profile?",
  "visibility": "public",
  "created_at": {"$date": "2026-10-13T10:02:11.000Z"}
}
```

### `categories`

| Field | Type | Required | Notes |
|---|---|---|---|
| `_id` | ObjectId | auto | |
| `name` | string | yes | **unique index**, 1–80 chars |
| `description` | string \| null | no | ≤ 500 chars |
| `is_active` | bool | yes | inactive = hidden from creation form; existing tickets keep the reference |
| `created_at`, `updated_at` | datetime | yes | |

```json
{
  "_id": {"$oid": "65f0abc1234567890abcdef3"},
  "name": "Network & VPN",
  "description": "Connectivity, VPN, DNS issues",
  "is_active": true,
  "created_at": {"$date": "2026-10-01T08:00:00.000Z"},
  "updated_at": {"$date": "2026-10-01T08:00:00.000Z"}
}
```

### `notifications`

In-app notifications, always scoped to one user.

| Field | Type | Required | Notes |
|---|---|---|---|
| `_id` | ObjectId | auto | |
| `user_id` | string (hex) | yes | → `users._id` (owner; the only reader) |
| `title` | string | yes | short headline |
| `body` | string \| null | no | preview text (message bodies truncated to 140 chars) |
| `ticket_id` | string (hex) \| null | no | → `tickets._id` when applicable |
| `is_read` | bool | yes | default `false` |
| `created_at` | datetime | yes | |

```json
{
  "_id": {"$oid": "65f0abc1234567890abcdef6"},
  "user_id": "65f0abc1234567890abcdef1",
  "title": "New reply on ticket #42",
  "body": "Could you try reconnecting the VPN profile?",
  "ticket_id": "65f0abc1234567890abcdef2",
  "is_read": false,
  "created_at": {"$date": "2026-10-13T10:02:11.500Z"}
}
```

### `audit_logs`

Write-once trail of significant actions (admins only via API).

| Field | Type | Required | Notes |
|---|---|---|---|
| `_id` | ObjectId | auto | |
| `action` | string | yes | dotted name, e.g. `auth.login`, `ticket.status_changed` |
| `actor_id` | string (hex) \| null | no | `users._id`; `null` for CLI/anonymous events |
| `entity_type` | string \| null | no | `user` \| `ticket` \| `category` |
| `entity_id` | string \| null | no | id (or email for CLI-seeded admins) |
| `details` | string \| null | no | short human-readable summary — **never** passwords/tokens/message bodies |
| `ip_address` | string \| null | no | client IP when available |
| `created_at` | datetime | yes | |

Known action names (from `app/services/audit.py` + the CLI):
`auth.register`, `auth.login`, `auth.login_failed`, `auth.profile_updated`,
`ticket.created`, `ticket.updated`, `ticket.status_changed`, `ticket.assigned`,
`ticket.unassigned`, `ticket.message_added`, `category.created`, `category.updated`,
`user.role_changed`, `user.activated`, `user.deactivated`, `user.created_admin`
(CLI only).

```json
{
  "_id": {"$oid": "65f0abc1234567890abcdef7"},
  "action": "ticket.status_changed",
  "actor_id": "65f0abc1234567890abcdef4",
  "entity_type": "ticket",
  "entity_id": "65f0abc1234567890abcdef2",
  "details": "open -> in_progress",
  "ip_address": "127.0.0.1",
  "created_at": {"$date": "2026-10-13T10:00:00.000Z"}
}
```

### `counters`

Tiny helper collection for human-readable ticket numbers.

| Field | Type | Notes |
|---|---|---|
| `_id` | string | fixed key `"ticket_number"` |
| `seq` | int | incremented atomically via `find_one_and_update` + `$inc` (upsert) |

```json
{ "_id": "ticket_number", "seq": 42 }
```

---

## Relationships (logical)

```
users 1─∞ tickets      (requester_id, assignee_id)
tickets 1─∞ ticket_messages   (ticket_id)
categories 1─∞ tickets  (category_id)
users 1─∞ notifications (user_id)
users 1─∞ audit_logs    (actor_id)
tickets 1─∞ audit_logs  (entity_id where entity_type="ticket")
```

Referential integrity is **application-level**: MongoDB has no foreign keys. Guards in
code (create/update validate category and assignee existence); deleting users is not
exposed by the API at all (admin can only deactivate), and categories are deactivated
rather than deleted, so dangling references only arise from direct database tampering.

## Retention / deletion behavior

- **Nothing is ever hard-deleted by the API.** There is no delete endpoint for any
  entity in v1.
- Users: deactivated (`is_active=false`), never removed.
- Categories: deactivated, never removed (history preserved).
- Tickets/messages/notifications/audit logs: retained indefinitely.
- The **test suite** drops only `ticket_management_db_test` (never the dev/prod
  database).

If data retention requirements exist for your organization, they must be implemented
before production use — see [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md).

## Related documents

- [DATABASE_INDEXES.md](DATABASE_INDEXES.md) — every index and why it exists
- [API_DOCUMENTATION.md](API_DOCUMENTATION.md) — how this data is exposed
