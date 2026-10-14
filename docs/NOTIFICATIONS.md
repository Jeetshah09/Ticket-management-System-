# Notifications

In-app notifications, stored in MongoDB and shown in the frontend's notification
center and header bell. There is **no email, SMS or push delivery** — in-app only.

## Triggers (server-side)

Notifications are created by the backend during the operation that caused them, in
the same request. They are best-effort: if the insert fails, the user's action still
succeeds and a warning is logged (a notification can never break a ticket operation).

| Event | Recipients | Title | Body |
|---|---|---|---|
| Ticket created | Every **active agent/admin except the requester** | `New ticket #<n>` | ticket subject |
| Ticket assigned | The new assignee (if it isn't the actor) | `Ticket #<n> assigned to you` | ticket subject |
| Status changed (agent/admin action) | The **requester** (unless they made the change) | `Ticket #<n> update` | `Your ticket 'X' is now <status>.` |
| Public reply | The **requester** (if the author isn't them) and the **assignee** (if the author isn't them). If a **customer** replies, all active agents/admins are notified instead. | `New reply on ticket #<n>` | message body truncated to 140 chars |
| Internal note | **Nobody** — notes never generate notifications | — | — |

Implementation: `backend/app/services/notifications.py`
(`create`, `create_for_many`, `agent_pool_ids`).

## Data model

One document per recipient per event in the `notifications` collection
([DATABASE.md](DATABASE.md#notifications)):
`user_id` (owner), `title`, `body?`, `ticket_id?`, `is_read` (default `false`),
`created_at`. Indexed by `(user_id, created_at desc)` for the feed and
`(user_id, is_read)` for the unread counter.

## API behavior

All routes are scoped to the authenticated user — a foreign notification id returns
**404** (not 403: existence is never leaked). See
[API_DOCUMENTATION.md](API_DOCUMENTATION.md#notifications).

- `GET /notifications` — newest first, paginated; `unread_only=1` filter; response
  envelope includes a global `unread_count` for the bell.
- `PATCH /notifications/{id}/read` — idempotent; returns the updated notification.
- `POST /notifications/read-all` — returns `{ "marked": n }`.

There is no delete endpoint; read-state is the only mutation.

## Frontend behavior

- **Page** (`/notifications`): list with unread highlighting, "mark as read" per row
  and "mark all as read"; clicking a row that carries a `ticket_id` navigates to that
  ticket.
- **Header bell** (`components/layout/notification-bell.tsx`): fetches the unread
  count and displays it; opens a dropdown of recent items.
- Counts and lists come straight from the API — nothing is computed or cached
  client-side beyond the current page.

## Privacy guarantees (tested)

- A user only ever receives their own notifications: the queries always filter by the
  caller's `user_id`, and foreign ids read as 404
  (`backend/tests/test_notifications.py::test_cannot_mark_other_users_notification_read`).
- Customers are never notified about internal notes (notes produce no notifications
  at all).
- Notification bodies derived from messages are truncated to 140 characters.

## Limitations

- **No delivery outside the app**: users must open the UI to see notifications.
- **No real-time push**: the bell refreshes on page load/navigation, not via
  WebSocket/SSE. A long-idle tab shows stale counts until reload.
- **No per-user preferences** (mute categories, digest, etc.).
- **Unbounded growth**: notifications are never deleted (no retention job).
- The agent-pool fan-out on *every* ticket creation writes one document per active
  staff member — fine for a class project, worth revisiting at scale (see
  [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md)).
