# Database Indexes

All indexes are created **idempotently at startup** by
`backend/app/db/mongo.py::ensure_indexes` (every `create_index` call is safe to re-run
— MongoDB returns the existing index if the definition matches). There is no separate
migration step; if you change index definitions, deploying the new code re-creates
them (modified definitions create an *additional* index — drop the old one manually in
that case).

Startup order: connect → `ping` (fail fast with a clear error if unreachable) →
`ensure_indexes` → serve.

## `users`

| Index | Keys | Why |
|---|---|---|
| email uniqueness | `email` **unique** | One account per email; makes login lookup an indexed point query and turns the register race into a clean duplicate-key error (handled → 409) |
| staff lookups | `role` + `is_active` | Powers `agent_pool_ids()` (notification recipients: active agents/admins) and admin user lists filtered by role |

## `tickets`

| Index | Keys | Why |
|---|---|---|
| ticket number | `ticket_number` **unique** | Human-readable id from the `counters` collection; uniqueness backs the "#42" reference |
| requester history | `requester_id` + `created_at` desc | Customer's ticket list ("My Tickets"), newest first — the most frequent customer query |
| assignee worklist | `assignee_id` + `created_at` desc | Agent's assigned tickets and the "assigned to me" filter |
| status | `status` | Status filters and the dashboard's active/done counts |
| priority | `priority` | Priority filters and the analytics by-priority aggregation |
| category | `category_id` | Category filters and per-category analytics |
| recency | `created_at` desc | Default sorting, 14-day creation trend aggregation |
| freshness | `updated_at` desc | "Recently updated" sorting (the default `sort_by` of `GET /tickets`) |

Notes:

- `assignee_id` is nullable (`null` = unassigned). The agent queue query
  (`assignee_id ∈ {my-id, null}`) uses this index.
- Filtering by `status`/`priority` uses the enum value as stored (strings), so the
  indexes are on low-cardinality fields — fine at this scale; combined filters are
  narrowed by the other indexed fields or in-memory.

## `ticket_messages`

| Index | Keys | Why |
|---|---|---|
| conversation order | `ticket_id` + `created_at` asc | The conversation view reads all messages of one ticket in chronological order (ascending) — a covered path for the hottest read on the detail page |

Visibility filtering (`visibility: "public"` for customers) happens on the small
per-ticket result set, so it is intentionally not indexed.

## `categories`

| Index | Keys | Why |
|---|---|---|
| name uniqueness | `name` **unique** | Duplicate category names → clean 409; also makes name lookups indexed |

## `notifications`

| Index | Keys | Why |
|---|---|---|
| user feed | `user_id` + `created_at` desc | The notifications page: one user's feed, newest first, paginated |
| unread count | `user_id` + `is_read` | Powers the header bell counter and the `unread_only=1` filter without scanning read items |

## `audit_logs`

| Index | Keys | Why |
|---|---|---|
| recency | `created_at` desc | Admin audit page is always "newest first", paginated |
| action filter | `action` | Filter by action family (queries use prefix regex `^ticket.`, which can use this index) |
| actor filter | `actor_id` | "Show everything this admin did" |
| entity filter | `entity_type` + `entity_id` | "History of this ticket/user/category" |

## `counters`

No index beyond `_id` (the automatic unique `_id` index). The single document
`{_id: "ticket_number"}` is mutated atomically with
`find_one_and_update({"$id": "ticket_number"}, {"$inc": {"seq": 1}}, upsert=True)`,
which is race-safe across concurrent requests.

## Verification

To inspect indexes on a running database (PowerShell + mongosh):

```javascript
// mongosh "mongodb://127.0.0.1:27017/ticket_management_db"
db.tickets.getIndexes()
db.users.getIndexes()
db.notifications.getIndexes()
```

The backend test suite exercises every indexed query path (list filters, notification
reads, audit filters) as part of its 96 tests — see [TESTING.md](TESTING.md).
