# National Commercial Bank Jamaica Medical Platform

A secure new-hire medical assessment intake and review platform. Clinicians submit
medical assessments for candidates, reviewers (HR) manage cases and communicate
decisions, and administrators manage users, roles, and system settings.

Next.js (App Router) monorepo managed with Turborepo and npm workspaces, backed by
Postgres via Prisma, Redis-backed sessions via Better Auth, and Redis-backed
rate limiting.

- `apps/web` — the Next.js application
- `packages/database` — Prisma schema, migrations, and repositories
- `packages/auth` — Better Auth configuration (email/password, Redis-backed sessions)
- `packages/redis` — shared ioredis client and rate-limiter helpers
- `packages/shared` — crypto helpers shared across packages

## Run locally

Requires Node 20+, a running Postgres instance, and a running Redis instance.

```bash
npm install
cp .env.example .env   # fill in POSTGRES_PASSWORD, AUDIT_DB_PASSWORD, APP_RUNTIME_DB_PASSWORD, DATABASE_URL, REDIS_PASSWORD, REDIS_URL, BETTER_AUTH_SECRET
docker compose up -d postgres redis   # or point DATABASE_URL/REDIS_URL at your own instances
npm run db:migrate:deploy
npm run dev
```

`AUDIT_DB_PASSWORD`/`APP_RUNTIME_DB_PASSWORD` are only needed here because the `postgres` container's
own init script requires them to create those two roles — a plain `npm run dev` still connects as
`ncb_medical_app` via `DATABASE_URL` either way, same as it always did, so any value works for local
dev; only a real deployment needs them to actually be different, least-privileged credentials (see
`DATABASE.md`'s "Security requirements" section).

Open [http://localhost:3000](http://localhost:3000).

On first run, `APP_MASTER_KEY` (used to encrypt data at rest) is generated
automatically and persisted to `apps/web/data/master.key` if not set in `.env`.
`BETTER_AUTH_SECRET` and `REDIS_PASSWORD`/`REDIS_URL` have no such fallback —
`.env` must set them (see `.env.example`, which includes a one-liner to
generate `BETTER_AUTH_SECRET`).

For local/demo accounts (one user per role, all sharing a demo password —
**never use in production**):

```bash
npm run db:seed:users
```

To bootstrap the first real admin account (a random password is generated and
printed once; `mustChangePassword` forces them to set their own on first login):

```bash
npm run db:create-admin -- admin@example.com "Display Name"
```

## End-to-end tests

Real-browser coverage (`e2e/role-access.spec.ts`) of the five seeded demo
roles — each one logs in, reaches its own pages, and is verifiably blocked
(not just at the HTTP layer, but genuinely never shown the page) from the
ones it doesn't hold permission for. Requires `npm run db:seed:users` to
have been run first, and Postgres/Redis reachable.

```bash
npx playwright install chromium   # first time only
npm run test:e2e
```

If `npx playwright install` can't reach `cdn.playwright.dev` (a
network-restricted environment), point Playwright at an already-installed
browser instead of downloading its own:

```bash
PLAYWRIGHT_BROWSER_CHANNEL=msedge npm run test:e2e   # or: chrome
```

## Run with Docker

```bash
cp .env.example .env   # fill in POSTGRES_PASSWORD, AUDIT_DB_PASSWORD, APP_RUNTIME_DB_PASSWORD, REDIS_PASSWORD, and BETTER_AUTH_SECRET
docker compose up -d --build
```

All five are required — `docker-compose.yml` fails immediately with a
"set X in .env" error for any of them left blank. `APP_MASTER_KEY` is the
only one of the `.env.example` values that's genuinely optional (see below).

This starts Postgres and Redis, runs Prisma migrations via a one-shot
`migrate` service, then starts the app. The `./data` folder is mounted into
the app container at `/app/apps/web/data`, keeping the generated master key
outside the image.

Open [http://localhost:3000](http://localhost:3000).

```bash
docker compose logs -f web
```

## What is included

- Role-based access: admin, HR reviewer, auditor (view-only), clinician/doctor, doctor's delegate
  (assistant scoped to one doctor's own caseload), patient/candidate.
- Per-user permission overrides on top of role defaults, editable from Settings → Permissions.
- Case lifecycle management: intake, assignment to a doctor, submission, review, billing/payment confirmation.
- Candidate and medical-office management.
- Notification templates (rich-text editor) with configurable SMTP, sent on case events.
- Message centre with resend support.
- SLA tracking and configurable SLA definitions per case event.
- Audit log of account and case actions, independently checkpointed in Redis so a database-only
  compromise can't retroactively rewrite history undetected.
- AES-256-GCM encryption at rest for sensitive fields, keyed by `APP_MASTER_KEY`.
- Authentication via Better Auth (native email/password), sessions and login/action
  rate limiting backed by Redis, with a configurable inactivity timeout
  (`SESSION_TIMEOUT_MINUTES`).
- One active session per account, enforced on every sign-in — an unrecognized device must pass a
  6-digit emailed code first (remembered for 30 days), and signing in anywhere always signs out
  every other session for that account.

## Environment variables

See `.env.example`. The application itself only reads:

- `APP_MASTER_KEY` — optional; a key is generated and persisted under `data/` if omitted.
- `COOKIE_SECURE` — set `true` in any real deployment (served over HTTPS).
- `SESSION_TIMEOUT_MINUTES` — inactivity timeout for authenticated sessions (5-480).
- `DATABASE_URL` — standard Prisma/Postgres connection string.
- `AUDIT_DATABASE_URL` — a separate connection string for `audit_events` only, using the
  least-privileged `ncb_audit_writer` role (see `DATABASE.md`); falls back to `DATABASE_URL` if
  unset, fine for quick local dev, not for a real deployment.
- `REDIS_URL` — standard Redis connection string (sessions, login/action rate limiting).
- `BETTER_AUTH_SECRET` — Better Auth's own signing secret; required, no fallback.
- `BETTER_AUTH_URL` — the app's externally-reachable origin, e.g. `https://portal.example.com`. Falls back to `http://localhost:3000` for local dev; **must** be set explicitly in any real deployment, or Better Auth derives the origin from the incoming request's Host header instead, which a proxy/spoofed request could influence.

`POSTGRES_PASSWORD`/`AUDIT_DB_PASSWORD`/`APP_RUNTIME_DB_PASSWORD`/`REDIS_PASSWORD` are read only by
`docker-compose.yml` itself (to configure the Postgres/Redis containers and the `web`/`migrate`
services' own database roles) — a plain `npm run dev` outside Docker never reads any of these four,
only the `DATABASE_URL`/`AUDIT_DATABASE_URL`/`REDIS_URL` connection strings above.

SMTP settings, notification templates, portal branding, and SLA definitions
are configured through the Settings admin UI and stored in the database, not
environment variables.

## Production checklist

Before using this with real medical data:

- Serve only over HTTPS and set `COOKIE_SECURE=true`.
- Set `BETTER_AUTH_URL` to your real domain — do not leave it unset in production.
- Store `APP_MASTER_KEY` and `BETTER_AUTH_SECRET` in a managed secret vault, not in the project folder.
- `APP_MASTER_KEY` has no rotation tooling today — every encrypted column (case/candidate/submission
  payloads, application settings) and every encrypted attachment on disk is unreadable without the
  exact key that encrypted it, and a rotation would mean re-encrypting all of it in one pass, not
  just swapping the env var. Back it up securely and treat losing it as a full-data-loss event; if
  rotation ever becomes necessary, that's a one-time migration script, not a config change.
- Require a password and TLS on Redis, and restrict network access to it the same way as Postgres — it holds live session tokens.
- Restrict database access by facility, reviewer group, and network policy where appropriate.
- Add secure backups, restore testing, retention rules, and deletion workflows.
- Complete legal/privacy review for applicable health-data and employment regulations.
- Run security testing before handling live records.
