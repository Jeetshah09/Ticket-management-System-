# User Guide (Customers)

How to use DeskFlow as a **customer** — someone who submits support requests and
follows their progress. (Agents: [AGENT_GUIDE.md](AGENT_GUIDE.md) · Admins:
[ADMIN_GUIDE.md](ADMIN_GUIDE.md).)

## Getting started

1. Open the app (locally: `http://localhost:3000`) and choose **Register**.
2. Enter your name, email, and a password (at least 8 characters). Your account is a
   customer account — that's all self-registration can create.
3. You land on the **Dashboard**. From now on, sign in with **Login** using your
   email and password.

If you ever forget whether you're signed in, the header shows your avatar/menu; an
expired session simply returns you to the login page and brings you back to where you
were after signing in.

## Creating a ticket

Click **New Ticket** (or the button on the dashboard) and fill in:

| Field | Guidance |
|---|---|
| **Subject** | One line describing the problem ("VPN fails after password reset") |
| **Description** | What happened, what you expected, steps to reproduce, error messages |
| **Category** | Pick the closest match (only active categories are listed) |
| **Priority** | `Low` (nuisance) · `Medium` (normal) · `High` (work blocked) · `Urgent` (critical/outage) |

Submit — the ticket gets a number (e.g. **#42**) and appears in **My Tickets** with
status **Open**.

## Tracking your tickets

- **My Tickets** lists only *your* tickets, newest activity first. Use the filters
  (status, priority, category) or the search box to find one quickly; the sort
  menu reorders by date, priority, or status.
- Opening a ticket shows the full **conversation** and its current status:

  | Status | What it means |
  |---|---|
  | Open | Received, not yet picked up |
  | In Progress | An agent is working on it |
  | Pending | Waiting on information (often from you) |
  | Resolved | The agent believes it's done |
  | Closed | Finished; archived |

- You can **reply** to the conversation at any time while the ticket is Open, In
  Progress, or Pending.
- While in those same states you may also edit the subject, description, priority, or
  category. Once a ticket is **Resolved or Closed it can no longer be edited** — reply
  instead and an agent can reopen it.
- You will **not** see agents' internal notes — those are private to the support
  team by design.

## Notifications

The **bell** in the header shows unread activity; the **Notifications** page lists
everything:

- You're notified when an agent replies and when the status changes.
- Click a notification to jump to the ticket; **Mark as read** (per item) or **Mark
  all as read** clears the bell.

## Your profile

**Profile** lets you change your display name and email address. Email must be
unique; sign out and back in after changing it if anything looks cached.

## Things customers cannot do (by design)

- Change a ticket's **status** — agents manage the workflow.
- **Assign** tickets — the support team allocates work.
- Post **internal notes** or read the support team's private notes.
- See, edit, or search **other customers' tickets or notifications** — the system
  only ever shows you your own.
- **Upload files** — attachments are not part of this version; paste text or error
  messages into the description/reply instead.
- Reset a forgotten password — contact your administrator (there is no self-service
  password reset in this version).

## Tips for faster resolution

1. One issue per ticket — split unrelated problems into separate tickets.
2. Include exact error text, timestamps, and what you already tried.
3. Answer promptly when a ticket shows **Pending** — that usually means the agent
   needs something from you.
4. Check priority honestly: marking everything Urgent slows triage for everyone.

Problems signing in or a page that won't load? See
[TROUBLESHOOTING.md](TROUBLESHOOTING.md).
