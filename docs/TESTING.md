# Testing

What tests exist, how to run them, what they cover, and — just as important — what
they do **not** cover. Only results that were actually observed are quoted here.

## Summary

| Suite | Tooling | Count | Last observed result |
|---|---|---|---|
| Backend | pytest (+ FastAPI TestClient) | **96 tests** | **96 passed in ~1m30s** |
| Frontend | Vitest + Testing Library (jsdom) | **24 tests** | **5 files, 24 passed in ~8s** |
| Frontend type-check | `tsc --noEmit` (strict) | — | clean (exit 0) |
| Frontend lint | ESLint (eslint-config-next) | — | clean (exit 0) |

## Backend tests

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -m pytest            # everything
python -m pytest tests/test_tickets.py -q          # one module
python -m pytest -k internal_note -q               # by name
```

### Configuration

- `backend/pytest.ini` — `testpaths = tests`, quiet output.
- `tests/conftest.py` sets environment variables **before** importing the app and
  clears the settings cache, so token signing/verification share one secret.
- **Isolation**: tests run against a real MongoDB but a **dedicated database**
  `ticket_management_db_test`, dropped before and after the session. Your normal
  `ticket_management_db` is never touched.
- **Optional external service**: if MongoDB is unreachable, the entire suite
  **skips** with the message *"MongoDB is not reachable — start mongod or set
  MONGO_URI to run the suite."* — it does not fail and does not fake passes.
- Auth rate limiting is disabled in tests (`AUTH_RATE_LIMIT_PER_MINUTE=0`) so rapid
  logins aren't throttled.
- Agents/admins are created by registering a customer via the API and promoting the
  account **directly in the test database** — mirroring the production CLI,

### Module → coverage map

| Module | Tests | Covers |
|---|---|---|
| `test_auth.py` | 20 | bcrypt round-trip/salting/garbage-input safety; JWT claims, wrong-secret rejection, non-`access` token rejection; register success/normalization/duplicate 409/short password 422/invalid email 422/**role field rejected 422**; login success/wrong-password 401/unknown-email 401 (no enumeration)/deactivated 403; `/auth/me` with no token 401, garbage token 401, foreign-secret token 401, valid 200; profile update name, role-field 422; logout 204 |
| `test_tickets.py` | 24 | create success (fields, defaults, requester=caller, ticket_number); unauthenticated 401; unknown category 404; malformed id 422; inactive category 400; missing fields 422; **customer list only shows own**; **customer cannot read other's ticket → 404**; detail envelope; 404 for missing/garbage ids; customer edits own fields; **customer status change → 403**; customer edit of other's → 404; agent status change; **invalid transition closed→pending → 400**; customer edit of resolved → 400; filters (priority, search); pagination envelope; bad `sort_by` → 422; **customer assign → 403**; agent self-assign + unassign; **assign-to-customer → 400**; **agent queue scoping** (unassigned visible, other agent's not); admin sees all |
| `test_messages.py` | 9 | customer reply; stranger reply → 404; agent reply; **customer internal note → 403**; agent internal note; **internal notes never visible to customer** (detail + list); notes visible to agents/admins; chronological order; whitespace body → 422 |
| `test_notifications.py` | 7 | reply notification delivered; **privacy (other user sees none)**; mark read; **foreign mark-read → 404**; read-all; invalid id → 404; unauthenticated → 401 |
| `test_admin.py` | 19 | categories: list active for customers; inactive hidden (admin opt-in); customer/agent create → 403; admin update; duplicate name 409; **deactivation preserves ticket references**; unauthenticated 401. users: customer/agent list → 403; admin search (no `password_hash` in response); role change; **self-deactivate 400**; **self-demote 400**; unknown id 404; customer update other → 403. audit-logs: admin-only (403/403/401); **records ticket.created with hydrated actor; no "password"/"token" strings**; actor filter. analytics: **customer overview scoped to own tickets, no admin fields**; admin sees more; agents endpoint 403/401; workload includes assigned counts. health: 200 + no sensitive strings. **OpenAPI: all 20 paths present; no attachment/upload routes** |

Counts by module: 27 + 24 + 9 + 7 + 19 = 86 test functions; several contain multiple
assertions, and the observed executed count was **96 passed**.

## Frontend tests

```powershell
cd frontend
npm test            # vitest run (single shot)
npm run test:watch  # watch mode
```

Config: `vitest.config.mts` (jsdom environment, `@` path alias, globals, setup file
`vitest.setup.ts`, CSS disabled).

| File | Tests | Covers |
|---|---|---|
| `lib/api-error.test.ts` | 6 | FastAPI `detail` string; 422 `loc`-array → field errors; `{detail:{field:msg}}`; network failure message; timeout message; `ApiError` passthrough |
| `lib/api-utils.test.ts` | 6 | Canonical `{items,…}` envelope; `{data, meta}` variant; `results` variant; missing totals; bogus values; `buildQuery` dropping empty keys |
| `lib/permissions.test.ts` | 3 | `hasRole` / `isCustomer` / `isAgent` / `isAdmin` / `canWorkTickets` / `canManageTicket` / `canAddInternalNote` / `canAssignTickets` / null user |
| `components/tickets/ticket-badges.test.tsx` | 3 | All 5 statuses, all 4 priorities, all 3 roles render a **text label** (never color-only) |
| `app/login/page.test.tsx` | 3 | Empty submit shows field errors; invalid email rejected client-side; **single-flight submit** (button disabled while pending, token persisted, navigation on success) |

Observed: `Test Files 5 passed (5) · Tests 24 passed (24)`.

## Checks that were actually run for this documentation

| Command | Observed result |
|---|---|
| `cd backend; python -m pytest` | `96 passed in 90.12s` |
| `python -m uvicorn app.main:app` (live boot) | `/api/v1/health` → `{"status":"ok","database":"ok"}`; OpenAPI exposes the documented paths; register→login→admin-CLI smoke over real HTTP succeeded |
| `cd frontend; npm test` | `24 passed` |
| `cd frontend; npm run typecheck` | exit 0, no output |
| `cd frontend; npm run lint` | exit 0, no output |

## Known gaps (honest list)

- **No CI pipeline** — no workflow files exist in the repository; tests run only
  when a developer runs them.
- **No E2E/browser tests** (no Playwright/Cypress). Login and the ticket flow were
  verified manually against the running backend, not by an automated browser suite.
- **No performance/load tests.** Page-size caps and indexes exist; no latency
  measurements were taken.
- **No mutation/coverage measurement** — coverage percentage is unknown (no
  `coverage` config).
- **Frontend has no component tests for most pages** (dashboard, ticket detail,
  admin pages) — only login and shared logic/badges are covered.
- **Concurrency** is untested (no optimistic locking; concurrent status writes are
  last-write-wins by design).
- **Rate limiting** is exercised manually at most; there is no dedicated test for
  the 429 path.

## Writing new tests ( conventions )

- Backend: happy path → permission denial (401/403/404) → validation (422) for every
  new endpoint; use the existing fixtures (`register_user`, `admin_account`,
  `category`) rather than raw database access, except for role promotion.
- Frontend: pure logic → `lib/`; user-visible behavior → Testing Library with
  `userEvent`; mock `services/` functions, not axios internals.
- Never weaken an assertion or add a skip to make a suite green; if a check must
  change, change the product and the assertion together, and update this document.
