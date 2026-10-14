# Contributing

How to work on DeskFlow locally, and what "done" looks like before a change is
merged. aimed at a small student/team project — lightweight but real discipline.

## Ground rules

1. **Describe reality.** Don't document, advertise, or stub features that don't
   work. If something is partial, label it (the docs' status vocabulary: *Implemented
   / Partially implemented / Not implemented / Planned*).
2. **The backend is the security boundary.** Any new data access gets server-side
   authorization; frontend gating is UX, not security.
3. **No AI/LLM features** — this project is intentionally a conventional helpdesk.
4. **No secrets in the repo.** `.env`/`.env.local` are gitignored; keep
   `.env.example` files placeholder-only.
5. **Don't break the three-folder layout**: `docs/`, `frontend/`, `backend/`.

## Local workflow

```powershell
git clone <repo-url>
cd <repo-root>

# one-time per machine
cd backend; python -m venv .venv; .\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env            # set a real JWT_SECRET
cd ..\frontend; npm install
Copy-Item .env.example .env.local

# each working session — two terminals
cd backend;  .\.venv\Scripts\Activate.ps1; python -m uvicorn app.main:app --reload
cd frontend; npm run dev
```

Full walkthroughs: [SETUP_GUIDE.md](SETUP_GUIDE.md),
[WINDOWS_SETUP.md](WINDOWS_SETUP.md).

## Branching & commits

- Branch from the mainline: `git checkout -b feature/<short-name>`,
  `fix/<short-name>`, or `docs/<short-name>`.
- Commit early and often with **imperative, specific** messages:

  ```
  add category usage endpoint for admins
  fix customer seeing internal notes in list response
  document ticket workflow transitions
  ```

- Keep commits focused: one logical change per commit (code + its tests + doc
  update together).
- Never commit `node_modules/`, `.venv/`, `.next/`, `__pycache__/`, `.env*` (except
  the `.example` files), or editor droppings. Both subprojects ship `.gitignore`s
  that cover these.

## Coding standards

**Backend (Python, FastAPI)**

- Python 3.11+; type-annotate public functions; keep functions small and single-
  purpose.
- Routers do HTTP only; business rules go in `app/services/`; response shaping in
  `app/utils/serialize.py`.
- Request models extend `ApiModel` (so unknown fields → 422). Enums only from
  `app/models/enums.py`.
- Raise `HTTPException` with a human-readable `detail`; 404 (not 403) for objects
  the caller may not see.
- Never log or return passwords, tokens, or hashes; audit/notification writes are
  best-effort (never fail the request).
- No new dependencies without discussion — the manifest is deliberately small.

**Frontend (TypeScript, Next.js)**

- Strict TypeScript; no `any` in contract code (`types/`, `services/`).
- New API surface: `types/` → `services/` → `useApi` in the component. No direct
  fetch/axios outside `services/`.
- Every data view renders loading/error/empty states; errors are user-readable.
- Reuse `components/ui` primitives; keep accessibility (labels, focus rings, text
  labels beside color, reduced motion).
- Enum labels/colors belong in `lib/constants.ts`, mirroring the backend values.

**Documentation (`docs/`)**

- Update the docs in the same PR as the behavior they describe; the doc set is
  cross-checked against code and OpenAPI.
- Use relative links between docs; only link files that exist.
- Never paste whole source files into docs.

## The "before you push" checklist

Run from a clean working tree:

```powershell
# backend
cd backend; .\.venv\Scripts\Activate.ps1
python -m pytest

# frontend
cd ..\frontend
npm test
npm run typecheck
npm run lint
```

All four must pass (expected counts: **96** backend, **24** frontend — see
[TESTING.md](TESTING.md); if your change legitimately adds/removes tests, update
those numbers in the docs).

Then manually smoke the affected flow against a running backend
([SETUP_GUIDE.md](SETUP_GUIDE.md#5-first-run--smoke-checklist)).

## Pull request review checklist

Reviewers verify, at minimum:

1. **Correctness** — behavior matches the description; no unrelated refactors.
2. **Authorization** — new endpoints/queries enforce role + object-level checks;
   invisible objects answer 404.
3. **Validation** — new inputs are validated (Pydantic/zod); no trust in client ids.
4. **Contract sync** — `backend/app/models/` ↔ `frontend/types/` (and
   `lib/constants.ts`) updated together when shapes/enums change.
5. **Tests** — new behavior has happy-path + permission-denial + validation tests;
   no weakened assertions, no decorative tests.
6. **Data safety** — no destructive migrations; indexes considered; nothing deletes
   user data (v1 has no delete endpoints — don't add one casually).
7. **Security hygiene** — no secrets, no tokens/passwords in logs or audit entries,
   no stack traces to clients.
8. **Docs** — `docs/` updated (feature status, API reference, env vars, workflow
   changes); READMEs still accurate.
9. **No AI features** crept in.

## Reporting bugs

Open an issue (or contact the maintainer privately for security matters — see
[SECURITY.md](SECURITY.md#reporting-a-vulnerability)) with:

- What you did, what you expected, what happened.
- Exact error text / status codes, and whether the backend or frontend printed it.
- Your environment (OS, Python, Node, MongoDB versions).
- For auth/permission bugs: the roles of both accounts involved (never real
  passwords!).

## Where to start

- Good first areas: documentation fixes, UI polish with tests, new analytics
  widgets backed by real aggregation queries.
- Read [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md) before starting anything
  large, and [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) for conventions.
