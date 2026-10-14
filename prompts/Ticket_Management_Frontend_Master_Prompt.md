# FRONTEND MASTER PROMPT --- TICKET MANAGEMENT SYSTEM

Act as a senior frontend engineer and product UI/UX designer. Build a
complete, polished, production-minded frontend for a conventional
**Ticket Management System**. This is a software support/helpdesk ticket
application, not an AI product.

## 1. Non-negotiable project rules

-   The project root must contain exactly these main project folders:
    `frontend/`, `backend/`, and `docs/`.
-   Work only in `frontend/` for this prompt. Do not create a second
    frontend folder or place frontend code at the project root.
-   The frontend must integrate with the real FastAPI backend and
    MongoDB-backed data through API calls.
-   **Do not add Gemini, AI, chat-with-AI, LLM, AI summaries, AI ticket
    classification, or any AI API integration.**
-   Do not make the product depend on permanent mock data. If the
    backend is unavailable, show a clear loading/error/empty state
    rather than pretending an operation succeeded.
-   Inspect the existing workspace before changing files. Reuse
    compatible code and avoid overwriting unrelated work.
-   Keep the frontend code maintainable, typed, accessible, responsive,
    and easy for a beginner to run on Windows.

## 2. Required technology stack

Use: - Next.js 15 with App Router - React 19 - TypeScript with strict
mode - Tailwind CSS - shadcn/ui components where appropriate - Lucide
React icons - Framer Motion for restrained, useful transitions - Axios
for HTTP requests - React Hook Form and Zod for form handling and
validation - Recharts for analytics charts - Sonner for toast
notifications - date-fns for date formatting

Use stable, compatible package versions. Do not introduce libraries
without a clear need.

## 3. Product and roles

Build a ticketing system with these roles: 1. **Customer** --- creates
and tracks their own support tickets, communicates with support, and
views notifications. 2. **Agent** --- views assigned/available tickets
according to permissions, responds to customers, adds internal notes if
authorized, and updates ticket status. 3. **Admin** --- manages users,
categories, ticket assignments, system-level views, audit logs, and
analytics.

The UI must show the correct navigation and actions for the signed-in
user's role. Do not rely on frontend role checks as the only security
control; the backend remains authoritative.

## 4. Required screens and routes

Create a coherent application with, at minimum:

### Public/authentication

-   Landing page describing the ticket system and its ordinary support
    workflow.
-   Login page.
-   Registration page for customers. Do not expose public admin
    registration.
-   Forgot-password screen only if a matching backend flow exists;
    otherwise clearly mark it as not implemented or omit it rather than
    faking functionality.
-   Friendly not-found and unauthorized/access-denied states.

### Shared authenticated layout

-   Responsive sidebar/navigation and header.
-   User profile menu, role label, notification entry, and logout
    action.
-   Breadcrumbs where useful.
-   Mobile navigation that works with touch.
-   Consistent loading, empty, error, and success states.

### Customer

-   Customer dashboard with ticket totals and recent tickets.
-   My Tickets list with search, filters, sorting, pagination, and
    status/priority indicators.
-   Create Ticket form with subject, category, priority, description,
    and attachment support if backend attachment APIs are available.
-   Ticket Details page with ticket metadata, conversation/replies,
    attachments where supported, and reply form.
-   Notifications list and read/unread state.
-   Profile/settings page.

### Agent

-   Agent dashboard showing assigned tickets, pending work, status
    breakdown, and recent activity.
-   Ticket queue/list with filters for status, priority, category,
    assignee, and date when supported by the API.
-   Ticket Details view with reply, status change, assignment actions,
    and internal notes only if supported and authorized.
-   Profile and notifications.

### Admin

-   Admin dashboard with ticket/user/category metrics and charts based
    on actual API data.
-   All Tickets view with filters and assignment actions.
-   User management: list/search users, inspect role/status, and update
    permitted fields if backend APIs exist.
-   Category management: create/edit/activate/deactivate categories if
    backend APIs exist.
-   Audit log viewer if backend API exists.
-   Profile/settings.

Do not create buttons that imply a feature works when no backend
endpoint exists. Either implement the complete flow or omit/disable the
action with a clear explanation.

## 5. UI/UX direction

Create a professional, modern helpdesk interface: - Clear visual
hierarchy, balanced whitespace, consistent typography, and restrained
color use. - Use cards, tables, badges, dialogs, dropdowns, tabs, and
forms consistently. - Use a clean neutral base with one accessible
primary accent color. - Distinguish ticket status and priority with
accessible badges and text, not color alone. - Include skeletons or
spinners for loading, useful empty states, retry actions for errors, and
confirmation dialogs for destructive actions. - Use responsive layouts
for desktop, tablet, and mobile. - Ensure keyboard navigation, visible
focus states, labels, useful validation messages, and accessible dialog
behavior. - Keep animations subtle and respect reduced-motion
preferences. - Avoid a generic unfinished template look. Build reusable
components and a consistent design system.

## 6. API integration requirements

-   Centralize the API base URL in environment configuration, for
    example `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1`.
-   Create a typed Axios client and reusable API modules/services for
    authentication, tickets, users, categories, notifications,
    analytics, attachments, and audit logs as applicable.
-   Add a request/response strategy for authentication tokens that
    matches the backend implementation. Never hardcode secrets.
-   Handle expired sessions, 401/403 responses, validation errors,
    server errors, timeouts, and network failures.
-   Keep API types aligned with the actual FastAPI request/response
    schemas. Inspect backend code/OpenAPI when available; do not guess
    fields.
-   Use environment variables for deployment-specific URLs.
-   Do not store passwords or sensitive information in local storage.
-   Prevent duplicate submissions and show a clear success/error toast
    only after the API result confirms the operation.
-   Use server or client components appropriately. Keep interactive
    components client-side only where needed.

## 7. Suggested frontend structure

Organize code clearly, adapting to the existing repository if necessary.
A reasonable structure is:

-   `frontend/app/` --- routes and layouts
-   `frontend/components/` --- shared UI and domain components
-   `frontend/components/ui/` --- shadcn/ui components
-   `frontend/contexts/` --- authentication/session context if needed
-   `frontend/hooks/` --- reusable hooks
-   `frontend/lib/` --- Axios client, utilities, constants, permissions
    helpers
-   `frontend/services/` --- typed API calls
-   `frontend/types/` --- shared TypeScript types
-   `frontend/public/` --- static assets
-   `frontend/.env.example`
-   `frontend/README.md`

Use a structure that is understandable and not unnecessarily
complicated.

## 8. Ticket concepts and expected behavior

Use the backend's actual schema as the source of truth. Common ticket
fields may include ticket number/ID, subject, description, category,
priority, status, requester, assignee, created/updated timestamps,
messages, and attachments.

Common status values may include Open, In Progress, Pending, Resolved,
and Closed; common priorities may include Low, Medium, High, and Urgent.
**Match the backend's actual enum values exactly** and do not silently
invent incompatible values.

The interface should make it clear: - who created a ticket, - who is
assigned, - its current status and priority, - when it was created or
updated, - what messages are public replies versus internal notes, - and
which actions the current role is permitted to perform.

## 9. Forms and validation

-   Use React Hook Form + Zod for login, registration, ticket creation,
    replies, profile edits, and admin forms.
-   Validate on the client for usability, but respect backend validation
    as authoritative.
-   Show field-level errors and preserve entered data when a recoverable
    request fails.
-   Validate attachment size/type according to backend limits when
    attachments are supported.
-   Disable submit buttons while requests are pending.

## 10. Quality and verification

-   Add meaningful tests for critical components and flows where
    practical.
-   Run linting, TypeScript checks, and production build; fix errors
    rather than merely reporting them.
-   Check all imports, links, routes, API payloads, loading states, and
    error handling.
-   Verify login/logout, role-based navigation, ticket creation, ticket
    details, replies, status updates, and notifications against the
    actual backend.
-   Do not claim tests passed unless they were run successfully.
-   Keep the app free of dead links, placeholder pages presented as
    finished features, and console errors.

## 11. Required deliverables

Within `frontend/`, deliver: - A complete runnable Next.js
application. - All required pages, reusable components, API services,
types, and validation. - `.env.example` with variable names and safe
example values only. - `README.md` with Windows setup and run
instructions, scripts, environment setup, and backend connection
instructions. - Tests and lint/type-check configuration where
appropriate.

## 12. Working method

1.  Inspect the repository and identify the existing frontend/backend
    API contract.
2.  Create or update the frontend in small coherent steps.
3.  Implement the shared layout and authentication before role-specific
    pages.
4.  Integrate real endpoints as the backend becomes available.
5.  Run checks and fix the issues found.
6.  At the end, summarize files created/changed, implemented features,
    commands to run, environment variables, tests/build results, and any
    genuine backend dependency still missing.

Build a usable, connected application---not just a static design or a
collection of disconnected pages.
