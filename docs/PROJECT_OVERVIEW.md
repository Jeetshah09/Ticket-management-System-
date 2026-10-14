# Project Overview

## Purpose

DeskFlow is a conventional ticket management (helpdesk) system that gives an
organization a single place to handle support requests. Customers submit tickets and
follow the conversation; support agents triage, reply, and track status; administrators
configure the system, manage staff accounts, and review activity through analytics and
audit logs.

It is deliberately **not** an AI product: there is no Gemini/LLM integration, no AI
classification, and no AI-generated replies anywhere in the codebase. Every behavior is
deterministic application logic that can be inspected in `backend/app/` and
`frontend/`.

## Problem statement

Support requests arriving through ad-hoc channels (chat, email threads, hallway
questions) are easy to lose, hard to prioritize, and impossible to audit. Requesters
don't know the state of their request, agents can't see who owns what, and
administrators have no visibility into workload or history. A ticketing system
centralizes requests with explicit ownership, an agreed status lifecycle, and a
permanent record.

## Objectives

1. Provide a self-service portal where customers create tickets and follow replies.
2. Give agents a shared queue with assignment, status workflow, and internal notes.
3. Give administrators user/category management, aggregate analytics, and audit logs.
4. Enforce **all** authorization on the server — hidden UI buttons are not security.
5. Run locally with minimal setup on Windows (PowerShell), using MongoDB.

## Scope

### In scope (implemented in v1)

- Email/password auth (JWT), three roles, server-side permission enforcement
- Ticket CRUD with pagination, filtering, search, sorting; validated status transitions
- Public replies and internal notes; assignment/unassignment
- Categories (admin-managed, safe deactivate policy)
- In-app notifications; role-scoped analytics; admin audit logs
- Next.js frontend for all three roles; FastAPI backend; MongoDB persistence

### Out of scope (v1)

- **File attachments** — not implemented; no endpoints exist (see
  [FILE_ATTACHMENTS.md](FILE_ATTACHMENTS.md))
- Password reset / change / email verification (no email sending exists in the stack)
- Real-time updates (WebSockets/SSE) — pages refresh on navigation/action
- Multi-tenant or organization support, SLA automation, CSAT, time tracking
- Server-side token revocation, OAuth/SSO, MFA

Anything above that is listed as "Planned" in
[DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md) is a *future* idea, not current
behavior.

## Stakeholders

| Stakeholder | Interest |
|---|---|
| Customer (requester) | Submit tickets, get replies, know the status |
| Support agent | Work the queue, reply publicly, note privately, manage status/assignment |
| Administrator | Manage users/categories, view analytics and audit trail |
| Developer/maintainer | Readable, tested, conventionally structured code |
| Reviewer/auditor | Verifiable permissions, audit logs, documented limits |

## Assumptions

- A single MongoDB instance is reachable from the backend (local `mongod` by default).
- The frontend and backend run on the same machine/host during development, with CORS
  restricted to configured origins.
- Trust boundary: the browser is untrusted; every request is authenticated and
  authorized again on the server.
- Staff accounts (agents/admins) are provisioned by an administrator or the seeding
  CLI, not by self-service signup — public registration always creates a *customer*.
- English-only UI and no localization requirements in v1.

## Known limitations

Summarized here; full detail in [SECURITY.md](SECURITY.md) and
[FEATURES.md](FEATURES.md):

1. No attachments, no password reset, no email at all.
2. Stateless JWT: logout is client-side; tokens cannot be revoked server-side before
   expiry (default lifetime 12 hours).
3. In-memory auth rate limiting protects one process only.
4. Notifications are in-app only (no email/push delivery).
5. Search is regex-based substring matching on subject/description — adequate for small
   datasets, not a full-text index.

## Related documents

- [FEATURES.md](FEATURES.md) — feature-by-feature status
- [ARCHITECTURE.md](ARCHITECTURE.md) — how the pieces fit together
- [REQUIREMENTS.md](REQUIREMENTS.md) — requirements traceability
