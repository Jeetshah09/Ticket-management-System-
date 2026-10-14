# Development Roadmap

What is **done**, what is **deliberately deferred**, and what a sensible next
version looks like. Nothing below is implemented unless the "Done" section says so —
everything else is explicitly *future work*.

## Done (v1 — current state)

Verified by the test suites and live checks (see [TESTING.md](TESTING.md)):

- ✅ Auth: registration, login, JWT (HS256) + bcrypt, profile, CLI-seeded admin
- ✅ Role-based authorization enforced server-side (customer / agent / admin),
  including object-level visibility with no existence leaks
- ✅ Ticket lifecycle: create, role-scoped list (filters/search/sort/pagination),
  detail with conversation, validated status state machine, assignment
- ✅ Public replies + staff-only internal notes (privacy-tested)
- ✅ Categories with safe deactivation policy and usage counts
- ✅ In-app notifications (creation, assignment, reply, status change) with
  unread counting
- ✅ Role-scoped analytics + admin agent-workload report
- ✅ Admin-only audit logs with action/actor/entity filters
- ✅ Full Next.js frontend for all three roles (dashboard, tickets, notifications,
  profile, admin area), loading/error/empty states throughout
- ✅ Idempotent index creation, fail-fast configuration, health endpoint
- ✅ 96 backend tests + 24 frontend tests; docs set under `docs/`

## Planned — high value, small-to-medium effort

These are the natural next steps, ordered by (impact ÷ effort). **None of them are
started.**

### 1. Token revocation on logout (security)
A denylist collection (`revoked_tokens`) storing token `jti`/hash until `exp`,
checked in `get_current_user`. Makes logout immediate instead of "eventually".
Touches: `core/security.py`, `dependencies/auth.py`, `db/mongo.py`, tests.

### 2. Password reset / change
Currently impossible for users to recover or rotate credentials. Needs: an email
transport (SMTP provider) or an admin-initiated reset flow (admin generates a
one-time reset, user sets a new password). Touches: new service + endpoints, email
config, frontend forms.

### 3. CI pipeline
GitHub Actions (or similar): install Python + Node, start MongoDB service
container, run `pytest`, `npm test`, `npm run typecheck`, `npm run lint` on every
push/PR. Would also enforce the doc-set link check. No workflow files exist yet.

### 4. Real-time notifications & queue refresh
Server-Sent Events (SSE) or polling for the notification bell and the ticket queue,
so agents see new tickets without reloading. Modest scope: a `/events` stream or a
`Last-Modified`-style poll endpoint.

### 5. First-response-time metric
The frontend `AnalyticsOverview` type already has an optional
`avg_first_response_hours` field the backend never populates. Implement with an
aggregation joining each ticket to its first public staff message.

### 6. E2E tests
Playwright suite covering the three role journeys (customer submit→reply, agent
triage→resolve, admin manage) against a seeded test database.

### 7. Attachment support (largest item)
Design is sketched in [FILE_ATTACHMENTS.md](FILE_ATTACHMENTS.md): GridFS storage,
metadata collection, server-side MIME sniffing, size limits (`python-multipart`),
ownership-checked downloads. Deliberately held back from v1.

## Backlog (real requests, bigger design needed)

| Idea | Notes |
|---|---|
| httpOnly-cookie sessions | Removes localStorage token exposure; change isolated to `lib/token.ts` + axios interceptor + backend cookie handling |
| Ticket merging / splitting, canned responses, tags | Common helpdesk features; needs schema + UI design |
| SLA timers & overdue queues | Requires per-category SLA config and a clock/background job |
| Full-text search (MongoDB text index or Atlas Search) | Replaces the regex substring search for larger datasets |
| Notification preferences & digests | Per-user settings; email channel depends on item 2 |
| Data retention & hard delete (GDPR-style) | v1 never deletes; needs cascade rules + audit of deletions |
| Metrics/observability (OpenTelemetry, structured JSON logs) | Current logging is basic stdlib |
| Multi-tenant / multiple brands | Major schema change — only if the product scope grows |
| Hardening pass for public internet | Per [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md#8-hardening-backlog-not-implemented-in-the-repo) |

## Explicit non-goals

Kept here so "roadmap" isn't misread as a promise:

- **Any AI/LLM feature** (classification, summaries, generated replies) — excluded
  by project decision, permanently, unless the product definition changes.
- Mobile native apps — the web frontend is the client.
- Replacing MongoDB or FastAPI — the stack is a requirement, not an accident.

## How to pick up an item

1. Read the linked docs (each roadmap item names its touch points).
2. Branch per [CONTRIBUTING.md](CONTRIBUTING.md); write tests with the feature.
3. Update the relevant docs *in the same PR* — especially [FEATURES.md](FEATURES.md)
   (status), [API_DOCUMENTATION.md](API_DOCUMENTATION.md) (routes),
   [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) (new vars), and this file.
