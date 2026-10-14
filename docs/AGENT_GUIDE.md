# Agent Guide (Support Staff)

How to use DeskFlow as a **support agent**. (Customers:
[USER_GUIDE.md](USER_GUIDE.md) · Admins: [ADMIN_GUIDE.md](ADMIN_GUIDE.md) · Full
rules: [TICKET_WORKFLOW.md](TICKET_WORKFLOW.md).)

Agent accounts are created by an administrator (a customer's role is promoted to
*agent*) — you cannot self-register as an agent.

## Your queue

The **Ticket Queue** (`/tickets`) shows everything you can act on:

- **Unassigned tickets** — the shared pool, waiting for pickup.
- **Tickets assigned to you**.
- **Tickets you submitted yourself** (as a customer).

Tickets assigned to *other* agents do not appear in your queue — they're that
agent's responsibility. Admins see everything.

Useful filters: status (`open`, `in_progress`, …), priority, category,
**Assignee = Me** or **Unassigned**, plus free-text search over subject/description
and sorting by created/updated date, priority, or status.

## Working a ticket

Open a ticket to see the conversation and the **Ticket actions** panel (only
agents/admins see it):

### 1. Claim it
Click **Assign to me** — the ticket moves into your personal worklist and other agents
stop seeing it in their unassigned queue. You can **Unassign** it later to return it
to the pool. Admins can additionally assign to any team member via the picker.

### 2. Set the status
The status dropdown offers the legal next states (the current one is disabled):

| You can move | To |
|---|---|
| Open | In Progress, Pending, Resolved, Closed |
| In Progress | Open, Pending, Resolved, Closed |
| Pending | Open, In Progress, Resolved, Closed |
| Resolved | Closed, Open (reopen), In Progress |
| Closed | Open (reopen) only |

Anything else is rejected by the server — the UI keeps you on the legal set anyway.
Resolving or closing asks for confirmation since the customer is notified.

**Rule of thumb:** pick up → *In Progress*; waiting on the customer → *Pending*;
done → *Resolved*; done and confirmed/aged out → *Closed*. Reopen (`Closed → Open`)
if the issue resurfaces.

### 3. Reply or leave an internal note
The reply box has two modes:

- **Reply to customer** (`public`) — visible to the customer and staff; the customer
  (and the assignee, if it isn't you) gets a notification.
- **Add internal note** (`internal`) — **staff only**. The customer never sees it,
  and it produces no notification. Use it for triage notes, vendor tickets, and
  hypotheses you don't want to commit to in writing.

Messages appear in chronological order; the ticket's *updated* time and message count
follow each post.

## What you cannot do (enforced by the server)

- See tickets that are assigned to another agent (unless you submitted them).
- Edit another customer's *profile*, manage users, categories, or read audit logs —
  those are admin-only (you'll get a clear "no permission" state if you try).
- Assign a ticket to a **customer** — assignees must be active agents or admins.
- Upload attachments (not implemented in this version).

## Notifications

You are notified when:

- A **new ticket** enters the queue (all active staff, minus the requester).
- A ticket is **assigned to you**.
- A **customer replies** to a ticket.

Open the bell in the header, or the **Notifications** page, and click an item to jump
to the ticket.

## Practical tips

1. Work **unassigned → In Progress → Resolved** in that order; claim before replying
   so colleagues don't double-handle.
2. Use **Pending** when you're blocked on the customer — it keeps queue metrics
   honest.
3. Write internal notes *as if the customer might read them someday* — professionalism
   still matters, and admins can see everything.
4. Status changes and assignment are recorded in the audit log with your name — that's
   normal and protects you (a clear trail shows what happened and when).

See [TICKET_WORKFLOW.md](TICKET_WORKFLOW.md) for the exact state machine and
[USER_ROLES_AND_PERMISSIONS.md](USER_ROLES_AND_PERMISSIONS.md) for the full agent
capability matrix.
