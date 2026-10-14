# Deployment Guide

How to take DeskFlow from a development checkout to a deployed system. **Nothing in
this repository has been deployed or verified on any hosting provider** — everything
below is preparation plus clearly-labeled *examples* of a conventional topology.
Treat provider names as illustrations, not endorsements or tested paths.

## What "deployed" means for this stack

| Component | Shape in production |
|---|---|
| Frontend | The Next.js app (`npm run build` → `npm start`), or a Node host. It is a standard SSR-capable app — **not** verified on serverless/edge runtimes. |
| Backend | One or more Uvicorn (FastAPI) processes behind a reverse proxy that terminates TLS |
| Database | A MongoDB deployment with authentication enabled and backups |
| (Optional) Reverse proxy | nginx / Caddy / Traefik / a cloud load balancer — TLS, security headers, rate limiting |

## 1. Pre-deployment checklist

- [ ] `JWT_SECRET`: a **fresh** long random value per environment (`python -c
      "import secrets; print(secrets.token_urlsafe(48))"`); never reuse dev secrets.
- [ ] `MONGO_URI` points at an authenticated MongoDB (`mongodb://user:pass@host/…`
      or a connection string from your provider) on a private network where possible.
- [ ] `MONGO_DB` set to the production database name (not the default if you share a
      cluster).
- [ ] `CORS_ORIGINS` lists **only** the real frontend origin(s), e.g.
      `https://support.example.com`. No wildcards.
- [ ] `ACCESS_TOKEN_EXPIRE_MINUTES` chosen deliberately (shorter = safer; users
      re-login more often).
- [ ] `AUTH_RATE_LIMIT_PER_MINUTE` left on; **plus** proxy-level rate limiting (the
      in-process limiter is per-instance only).
- [ ] Frontend `NEXT_PUBLIC_API_BASE_URL` set to the public API URL **including
      `/api/v1`**, then `npm run build` (env is baked in at build time).
- [ ] HTTPS everywhere; HTTP→HTTPS redirect at the proxy.
- [ ] Security headers at the proxy (HSTS, `X-Content-Type-Options: nosniff`,
      `X-Frame-Options: DENY` or frame-ancestors CSP, a baseline CSP).
- [ ] MongoDB backups scheduled and **restored once** to prove they work.
- [ ] Log retention for the backend process (systemd journal, Docker logging, etc.).
- [ ] A seeded admin account created via `scripts/create_admin.py` on the production
      host — never a default credential, never committed.

## 2. Backend deployment (example: Linux VM + systemd)

```powershell
# build steps (any OS), then on the server:
python -m venv /opt/tms/backend/.venv
/opt/tms/backend/.venv/bin/pip install -r requirements.txt
# place .env next to the app (chmod 600), set production values
```

Example unit file `/etc/systemd/system/tms-backend.service`:

```ini
[Unit]
Description=DeskFlow API
After=network.target mongod.service

[Service]
WorkingDirectory=/opt/tms/backend
ExecStart=/opt/tms/backend/.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=on-failure
User=tms

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now tms-backend
curl -fsS http://127.0.0.1:8000/api/v1/health   # expect {"status":"ok","database":"ok"}
```

Notes:

- Startup **fails fast** on missing `JWT_SECRET` or unreachable MongoDB — the unit
  will exit visibly, which is what you want.
- Multiple `--workers` (or instances) are fine for statelessness, but remember each
  process has its **own** auth rate-limit counter.
- Windows servers: run the same command under a service wrapper (NSSM, WinSW) or a
  scheduled task; the app itself is OS-agnostic.

## 3. Frontend deployment (example: same VM behind the proxy)

```powershell
npm ci                 # reproducible install from package-lock.json
$env:NEXT_PUBLIC_API_BASE_URL = "https://api.example.com/api/v1"
npm run build
npm start              # serves the production build (port 3000 by default)
```

Run it under its own service (same pattern as above) on an internal port, and let the
reverse proxy serve it at the public origin. **Rebuild whenever the API URL changes**
— `NEXT_PUBLIC_*` values are inlined at build time.

> Provider examples (illustrative only, untested here): any Node-capable host
> (VM, Fly.io, Railway, Render…) for the frontend and API; MongoDB Atlas or a
> self-hosted `mongod` for the database. Serverless/edge deployment of this Next.js
> app has **not** been verified and may require adapters.

## 4. Reverse proxy sketch (nginx example — illustrative)

```nginx
# TLS termination + security headers + rate limiting
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;

server {
  listen 443 ssl http2;
  server_name support.example.com;
  # ssl_certificate ...; ssl_certificate_key ...;

  add_header Strict-Transport-Security "max-age=31536000" always;
  add_header X-Content-Type-Options nosniff always;
  add_header X-Frame-Options DENY always;

  location /api/v1/auth/ {
    limit_req zone=auth burst=10 nodelay;
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

The backend records `X-Forwarded-For`-derived IPs only as provided by the proxy
client field; it does not parse forwarded headers itself — keep the API on a private
port reachable only from the proxy.

## 5. Database

- Enable `authorization` in MongoDB, create a dedicated user with readWrite on the
  production database, and put its credentials in `MONGO_URI` (env only).
- Indexes create themselves idempotently on first startup
  ([DATABASE_INDEXES.md](DATABASE_INDEXES.md)) — no migration step.
- Backups: `mongodump` on a schedule (example:
  `mongodump --uri="$MONGO_URI" --out /backups/$(date +%F)`) plus retention. Test a
  restore.
- This version **never deletes data** (no delete endpoints), so growth is monotonic:
  monitor disk usage.

## 6. Post-deploy verification (minimum)

1. `GET /api/v1/health` → 200 `{"status":"ok","database":"ok"}`.
2. Frontend loads; register a test customer; create a ticket.
3. Sign in as the seeded admin; see the ticket; change status; check audit log.
4. Confirm a **wrong** password returns 401 with the generic message; confirm 429
   appears after repeated failures.
5. Confirm CORS: the real origin works, a foreign origin is blocked.
6. Confirm HTTPS redirect and that `http://` leaks nothing.
7. Open `/docs` — decide deliberately whether to keep public docs (fine for
   internal tools; consider disabling for public deployments by not shipping the
   route in a hardened variant).

## 7. Updates

```powershell
git pull
cd backend; .\.venv\Scripts\Activate.ps1; python -m pip install -r requirements.txt
cd ..\frontend; npm ci; npm run build
# restart both services
```

Backend startup re-checks configuration and indexes; a failed start leaves the old
process/model untouched only if you use proper service restarts — test in a staging
environment first.

## 8. Hardening backlog (not implemented in the repo)

- Rate limiting at the proxy for **all** routes, not just auth.
- Server-side token revocation (denylist) to make logout immediate.
- httpOnly cookie auth instead of `localStorage` tokens.
- Content-Security-Policy tuned for the Next.js runtime; consider disabling `/docs`.
- Centralized logs/metrics (e.g. OpenTelemetry) — the app only does basic logging.
- Secrets manager instead of `.env` files.

See [SECURITY.md](SECURITY.md) for the full limitations list.
