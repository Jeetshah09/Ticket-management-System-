# BACKEND MASTER PROMPT --- TICKET MANAGEMENT SYSTEM

Act as a senior Python backend engineer and API/security architect.
Build a complete, maintainable backend for a conventional **Ticket
Management System** used by customers, support agents, and
administrators. This is a standard ticketing/helpdesk application, not
an AI product.

## 1. Non-negotiable project rules

-   The project root must contain exactly these main project folders:
    `frontend/`, `backend/`, and `docs/`.
-   Work only in `backend/` for this prompt. Do not create another
    backend folder or place backend source files at the project root.
-   Use MongoDB as the database. Do not replace it with PostgreSQL,
    MySQL, SQLite, or an ORM-based SQL design.
-   **Do not add Gemini, AI, LLM features, AI classification,
    AI-generated replies, or any AI API integration.**
-   Inspect the existing workspace before changing files. Preserve
    compatible work and avoid unnecessary rewrites.
-   Build real endpoints and persistence. Do not make success responses
    that do not actually save or update data.
-   Keep code modular, secure, tested, and straightforward to run on
    Windows.

## 2. Required technology stack

Use: - Python 3.11 or newer - FastAPI - Uvicorn - Pydantic / Pydantic
Settings - PyMongo's async API where supported by the installed version;
select a compatible, supported async approach and document it -
MongoDB - JWT-based authentication with secure password hashing - pytest
and HTTPX for tests - python-multipart if file uploads are implemented -
Standard logging and environment-based configuration

Use stable compatible dependencies. Do not add Redis or other
infrastructure unless truly required by the existing application.

## 3. Roles and permissions

Implement three roles: - **customer**: register/login, create tickets,
view only their own tickets, reply to their own tickets when permitted,
view their notifications, and update allowed profile fields. -
**agent**: view tickets permitted by the assignment/queue rules, respond
to tickets, update permitted statuses, assign tickets if authorized, and
add internal notes only if the system supports them. - **admin**: manage
users, categories, assignments, all tickets, analytics, and audit logs
according to explicit permissions.

Enforce all authorization on the backend. A hidden frontend button is
not security. Prevent customers from reading or modifying other
customers' tickets. Protect administrative endpoints. Validate all
user-supplied IDs and fields.

## 4. Database

Use MongoDB with database name `ticket_management_db`, configured by
environment variable. Create and document collections as appropriate,
preferably including: - `users` - `tickets` - `ticket_messages` -
`categories` - `notifications` - `attachments` (metadata; binary storage
strategy must be explicitly selected) - `audit_logs` - `counters` (only
if needed for human-readable ticket numbers)

Use MongoDB `ObjectId` consistently and serialize it safely in API
responses. Add appropriate indexes for email uniqueness, ticket lookup,
requester/assignee, status, priority, category, timestamps, notification
reads, and audit-log queries. Create indexes safely at startup or
through a documented initialization command.

Avoid storing uploaded files as huge base64 strings inside normal ticket
documents. If attachments are implemented, choose a practical storage
strategy, enforce limits, and store metadata in MongoDB. If GridFS or
local disk storage is selected, document its trade-offs and setup.

## 5. Authentication and security

Implement: - Customer registration. - Login. - Current-user/profile
endpoint. - Logout/session invalidation strategy appropriate to the
chosen JWT design. - Password hashing with a modern password-hashing
library. - JWT access-token creation and validation. - Expiration and
safe secret configuration. - Role/permission dependencies. - Consistent
401 and 403 behavior. - Input validation and normalized email
addresses. - Safe CORS configuration through environment settings. -
Rate limiting on authentication only if it can be implemented reliably
without unnecessary infrastructure; otherwise document deployment-level
protection. - No secrets committed to source control.

Do not expose public admin registration. Seed/create the first admin
through a documented CLI/initialization process that does not create a
default public password. Never return password hashes or sensitive token
data unnecessarily.

## 6. Ticket lifecycle and features

Implement real, persistent functionality for:

### Tickets

-   Create a ticket with subject, description, category, priority, and
    requester derived from the authenticated user.
-   List tickets with pagination, filtering, sorting, and search.
-   Retrieve a ticket with authorized details and its conversation.
-   Update allowed fields and status according to role and workflow.
-   Assign/reassign tickets according to permissions.
-   Track creation/update timestamps.
-   Use a consistent status/priority enum. Define it once and make
    frontend-facing schemas match it.
-   Validate state transitions; prevent invalid or unauthorized changes.

### Ticket messages

-   Add public replies to tickets.
-   Support internal notes only if permission and data visibility are
    implemented correctly.
-   Ensure internal notes are never returned to customers.
-   Validate that the caller is allowed to participate in the ticket.
-   Return conversation messages in a predictable chronological order.

### Categories

-   List active categories for ticket creation.
-   Admin create/update/activate/deactivate operations.
-   Prevent deletion or deactivation behavior from breaking existing
    tickets; choose and document a safe policy.

### Notifications

-   Create in-app notifications for relevant events such as ticket
    creation, assignment, new reply, and status change.
-   List notifications for the authenticated user with
    pagination/filtering as appropriate.
-   Mark one notification or all notifications as read.
-   Never expose another user's notifications.

### Attachments

-   If implemented, support authorized upload/download, file size/type
    validation, safe filenames, metadata, and ownership checks.
-   Do not trust the client-provided content type alone.
-   Ensure a customer cannot download another customer's private
    attachment.
-   If attachments are omitted from the first release, document this
    clearly and do not expose fake endpoints.

### Analytics

-   Provide role-appropriate aggregate metrics, such as ticket counts by
    status/priority and workload/recent trends.
-   Use MongoDB aggregation or appropriate queries.
-   Avoid leaking customer data through aggregate or admin-only
    endpoints.

### Audit logs

-   Record significant security and administrative actions, ticket
    assignment/status changes, and relevant account/category management
    events.
-   Restrict audit-log access to authorized administrators.
-   Do not log passwords, secrets, access tokens, or sensitive
    attachment contents.

## 7. API organization

Use a versioned API prefix such as `/api/v1`. Organize routes by domain,
for example: - `/auth` - `/users` - `/tickets` - `/categories` -
`/notifications` - `/analytics` - `/attachments` - `/audit-logs`

Use REST conventions and clear status codes. Suggested endpoint concepts
include: - `POST /api/v1/auth/register` - `POST /api/v1/auth/login` -
`GET /api/v1/auth/me` - `GET /api/v1/tickets` - `POST /api/v1/tickets` -
`GET /api/v1/tickets/{ticket_id}` -
`PATCH /api/v1/tickets/{ticket_id}` -
`POST /api/v1/tickets/{ticket_id}/messages` -
`POST /api/v1/tickets/{ticket_id}/assign` -
`GET /api/v1/notifications` -
`PATCH /api/v1/notifications/{notification_id}/read`

These are examples: finalize endpoint names consistently and document
the actual implemented routes. Use FastAPI's OpenAPI docs and ensure
schemas are accurate.

## 8. Suggested backend structure

Adapt to the repository as needed, but keep separation of concerns. For
example: - `backend/app/main.py` - `backend/app/core/config.py` -
`backend/app/core/security.py` - `backend/app/db/mongo.py` -
`backend/app/models/` --- Pydantic request/response models and enums -
`backend/app/api/v1/` --- routers - `backend/app/services/` --- business
logic - `backend/app/repositories/` --- database operations where
useful - `backend/app/dependencies/` --- auth/permission dependencies -
`backend/app/utils/` --- shared helpers - `backend/tests/` -
`backend/.env.example` - `backend/requirements.txt` or
`pyproject.toml` - `backend/README.md`

Do not add unnecessary abstraction layers. Keep business rules testable.

## 9. Configuration and errors

-   Use environment variables for MongoDB URI, database name, JWT
    secret, token expiry, CORS origins, upload limits, and other
    required settings.
-   Provide `.env.example` with placeholders only; never include real
    credentials.
-   Fail fast with a clear startup error when essential configuration is
    missing.
-   Add centralized exception handling and consistent error response
    structures.
-   Do not leak stack traces, internal paths, database credentials, or
    secrets to clients.
-   Add health/readiness endpoint(s), e.g. `/health`, without exposing
    sensitive diagnostics.
-   Use structured, useful logs and avoid logging sensitive data.

## 10. Testing requirements

Write tests for at least: - Registration and login success/failure. -
Password hashing and token validation. - Role permissions and
unauthorized access. - Customers cannot read other customers' tickets. -
Ticket create/list/detail/update and invalid state transitions. -
Replies and internal-note privacy, if internal notes exist. - Assignment
permissions. - Category admin permissions. - Notifications are private
to their owner. - Input validation and expected error codes.

Use isolated test data and a test database/configuration. Do not run
destructive tests against the developer's normal database. Make external
services optional for tests where practical.

## 11. Required deliverables

Inside `backend/`, provide: - Complete FastAPI application and API
routers. - MongoDB connection/configuration and index initialization. -
Authentication and role-based authorization. - Ticket workflow,
messages, categories, notifications, analytics, audit logs, and
attachments if implemented. - Tests and dependency manifest. -
`.env.example`. - `README.md` with Windows PowerShell setup, environment
configuration, database setup, admin initialization, run/test commands,
and API docs URL.

## 12. Working method

1.  Inspect the existing repository and frontend needs.
2.  Confirm the actual API contract and shared enums.
3.  Implement configuration/database connection and authentication
    first.
4.  Implement ticket CRUD/workflow, messages, and authorization.
5.  Add categories, notifications, analytics, audit logs, and optional
    attachments.
6.  Run tests and fix errors.
7.  Confirm OpenAPI docs match the implementation.
8.  Report changed files, endpoints, environment variables, commands,
    test results, and any feature not implemented.

Deliver a functioning backend, not just route stubs. Every advertised
endpoint must validate permissions and perform the promised behavior.
