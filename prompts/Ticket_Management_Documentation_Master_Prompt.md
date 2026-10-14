# DOCUMENTATION MASTER PROMPT --- TICKET MANAGEMENT SYSTEM

Act as a senior technical writer and software documentation engineer.
Inspect the actual Ticket Management System codebase and produce
complete, accurate documentation for developers, testers, users, and
project reviewers.

## 1. Non-negotiable project rules

-   The project root must contain these main folders: `docs/`,
    `frontend/`, and `backend/`.
-   Put the main project documentation in `docs/`. Keep the
    frontend-specific README in `frontend/README.md` and
    backend-specific README in `backend/README.md`.
-   **This is a conventional ticketing/helpdesk system. Do not document
    or add Gemini, AI, LLM, AI summaries, AI classification, or any AI
    features.**
-   Inspect the actual source code, configuration, routes, schemas, UI,
    and tests before writing documentation.
-   Documentation must describe what is implemented, not what a prompt
    hoped to implement.
-   Never invent endpoints, fields, roles, permissions, workflows,
    environment variables, test results, or deployment behavior.
-   If a planned feature is missing or incomplete, label it clearly as
    "Planned," "Not implemented," or "Partially implemented."
-   Keep instructions practical for a student developer using Windows
    and PowerShell.

## 2. First inspect the repository

Before writing docs: 1. Inspect the root directory and confirm the
`frontend/`, `backend/`, and `docs/` folders. 2. Read frontend
package/config files, route structure, components, services, and
environment examples. 3. Read backend dependencies, FastAPI routers,
Pydantic schemas, authentication/permission logic, database code, and
tests. 4. Identify the actual MongoDB database/collection names and
indexes. 5. Inspect actual API routes through source code and/or FastAPI
OpenAPI output when available. 6. Run relevant checks only when possible
and record the actual results. 7. Create a feature matrix with status:
Implemented, Partially implemented, Planned, or Not implemented. 8.
Resolve contradictions by following the source code and tests; do not
silently guess.

## 3. Required documentation files

Create these files inside `docs/`, as applicable to the actual project:

1.  `README.md` --- main entry point, overview, feature list,
    architecture summary, prerequisites, quick start, links to all
    important docs.
2.  `PROJECT_OVERVIEW.md` --- purpose, problem statement, objectives,
    scope, stakeholders, assumptions, and limitations.
3.  `FEATURES.md` --- feature inventory with implementation status.
4.  `REQUIREMENTS.md` --- functional and non-functional requirements.
5.  `ARCHITECTURE.md` --- components, request flow,
    frontend/backend/database interactions, Mermaid diagrams if helpful.
6.  `DATABASE.md` --- database name, collections, fields,
    relationships/references, indexes, and example document shapes based
    on actual code.
7.  `DATABASE_INDEXES.md` --- indexes and why they exist, based on
    actual initialization code.
8.  `API_DOCUMENTATION.md` --- actual endpoint list, methods, auth
    requirements, parameters, request/response examples, status codes,
    and error format.
9.  `AUTHENTICATION_AND_AUTHORIZATION.md` --- login/token behavior,
    password hashing, session/token expiry, permissions, and
    limitations.
10. `USER_ROLES_AND_PERMISSIONS.md` --- customer/agent/admin capability
    matrix based on actual enforcement.
11. `TICKET_WORKFLOW.md` --- actual status lifecycle, assignment rules,
    replies, internal notes if implemented, and invalid transitions.
12. `NOTIFICATIONS.md` --- event triggers, list/read behavior,
    persistence, and limitations.
13. `FILE_ATTACHMENTS.md` --- upload/download flow, storage, validation,
    access control, and limits; if not implemented, state that clearly.
14. `FRONTEND_GUIDE.md` --- routes, layouts, component organization, API
    services, validation, and UI conventions.
15. `BACKEND_GUIDE.md` --- app structure, routers,
    services/repositories, models, dependencies, and request lifecycle.
16. `SETUP_GUIDE.md` --- full local setup from a clean checkout.
17. `WINDOWS_SETUP.md` --- PowerShell-specific commands for Windows.
18. `ENVIRONMENT_VARIABLES.md` --- every required/optional variable,
    purpose, example placeholder, and default if one actually exists.
19. `USER_GUIDE.md` --- customer-facing instructions.
20. `AGENT_GUIDE.md` --- agent workflows and permissions.
21. `ADMIN_GUIDE.md` --- admin workflows, user/category management,
    assignments, and audit logs if implemented.
22. `DEVELOPER_GUIDE.md` --- code layout, conventions, development
    workflow, and contribution steps.
23. `TESTING.md` --- test commands, coverage scope, test configuration,
    and actual test results only when run.
24. `SECURITY.md` --- implemented security controls, sensitive-data
    handling, known limitations, and safe reporting of vulnerabilities.
25. `TROUBLESHOOTING.md` --- likely issues grounded in the stack and
    observed errors, with checks and remedies.
26. `DEPLOYMENT_GUIDE.md` --- deployment preparation and steps supported
    by the actual stack; clearly label provider-specific examples as
    examples.
27. `CONTRIBUTING.md` --- local workflow, branch/commit guidance, coding
    standards, and review checklist.
28. `CHANGELOG.md` --- current initial release/history based only on
    known changes; do not invent dates or past releases.
29. `DEVELOPMENT_ROADMAP.md` --- completed work and clearly labeled
    future enhancements.
30. Add or update `frontend/README.md` and `backend/README.md` so each
    subproject can be run independently.

If a file's subject does not apply because the feature is absent, still
create the file where useful and explain its current status rather than
documenting a nonexistent implementation.

## 4. Documentation content requirements

### Main README

Include: - Project name and concise description. - Current
implementation status. - Feature summary. - Technology stack. - Folder
structure. - Prerequisites. - MongoDB configuration. - Frontend and
backend setup commands. - Environment file setup. - How to start both
applications in separate terminals. - Default local URLs and API docs
URL only if confirmed by config. - Test, lint, type-check, and build
commands that actually exist. - Links to the detailed documentation. -
Known limitations and security notes.

### Architecture

Describe actual component boundaries and data flow. Add Mermaid diagrams
if useful, such as: - user browser → Next.js frontend → FastAPI API →
MongoDB - authentication and ticket creation sequence Never include an
architecture component that does not exist.

### Database

For each actual collection, document: - purpose, - field names and
types, - required/optional status when evident, -
relationships/references, - indexes, - data retention/deletion behavior
if implemented. Use sanitized example documents; never include real user
data, passwords, tokens, or secrets.

### API reference

For every implemented route, include: - HTTP method and full path, -
purpose, - authentication and required role, - path/query parameters, -
request schema and safe example, - response schema and safe example, -
possible status codes, - validation/error behavior. Cross-check the list
against FastAPI's registered routes/OpenAPI schema. Do not list
suggested endpoints as implemented unless they exist.

### Roles and workflows

Build a role-permission matrix based on backend enforcement and frontend
behavior. Explain ticket creation, assignment, status transitions,
replies, internal notes, notifications, and attachment access only to
the extent actually implemented.

### Setup and environment

Document exact commands for Windows PowerShell. Include Python virtual
environment setup, backend dependency installation, MongoDB
setup/connection, frontend package installation, environment files, and
startup commands. Never publish secrets. Keep `.env.example` values
illustrative only.

### Testing and security

Separate: - tests that exist, - commands that were run, - actual
results, - tests not run, - known gaps. Do not claim full security,
production readiness, or passing tests without evidence. Include
practical limitations and follow-up actions.

## 5. Style and quality standards

-   Write clear, professional English suitable for a college project and
    a new developer.
-   Use headings, tables, numbered procedures, code blocks, and examples
    where useful.
-   Define technical terms briefly when first used.
-   Keep naming consistent with the source code.
-   Prefer relative links between documents inside the repository.
-   Ensure links point to files that exist.
-   Avoid duplicated sections; use links to the authoritative detailed
    document.
-   Include a last-reviewed date only if you can establish it; otherwise
    omit it.
-   Do not include personal data or credentials.
-   Do not paste entire source files into documentation.
-   Keep documentation actionable and specific, not generic filler.

## 6. Final validation

After creating/updating the docs: 1. Verify every required document
exists. 2. Verify every internal relative link points to an existing
file. 3. Cross-check routes and examples against the actual backend. 4.
Cross-check environment variables against configuration files. 5.
Cross-check feature status against source code and tests. 6. Ensure all
commands and file paths match the repository. 7. Clearly identify
incomplete features and unresolved questions. 8. Do not change
application behavior merely to make the docs look complete.

## 7. Final response required from you

When finished, report: - documentation files created or updated, - any
requested document that could not be completed due to missing
implementation/evidence, - validation performed, - known gaps, - and the
recommended order for a new developer to read the docs.

The final result must be a trustworthy documentation set for the real
project, not aspirational documentation for features that do not exist.
