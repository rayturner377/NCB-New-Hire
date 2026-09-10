# National Commercial Bank Jamaica Medical Platform

A secure new-hire medical assessment intake and review platform. Clinicians submit
medical assessments for candidates, reviewers (HR) manage cases and communicate
decisions, and administrators manage users, roles, and system settings.

Next.js (App Router) monorepo managed with Turborepo and npm workspaces, backed by
Postgres via Prisma.

- `apps/web` — the Next.js application
- `packages/database` — Prisma schema, migrations, and repositories
- `packages/shared` — crypto/auth helpers shared across packages

## Run locally

Requires Node 20+ and a running Postgres instance.

```bash
npm install
cp .env.example .env   # fill in POSTGRES_PASSWORD and DATABASE_URL
docker compose up -d postgres   # or point DATABASE_URL at your own Postgres
npm run db:migrate:deploy
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

On first run, `APP_MASTER_KEY` (used to encrypt data at rest) is generated
automatically and persisted to `apps/web/data/master.key` if not set in `.env`.

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

## Run with Docker

```bash
cp .env.example .env   # fill in POSTGRES_PASSWORD and APP_MASTER_KEY
docker compose up -d --build
```

This starts Postgres, runs Prisma migrations via a one-shot `migrate`
service, then starts the app. The `./data` folder is mounted into the app
container at `/app/data`, keeping the generated master key outside the image.

Open [http://localhost:3000](http://localhost:3000).

```bash
docker compose logs -f web
```

## What is included

- Role-based access: admin, HR reviewer, auditor (view-only), clinician/doctor, patient/candidate.
- Per-user permission overrides on top of role defaults, editable from Settings → Permissions.
- Case lifecycle management: intake, assignment to a doctor, submission, review, billing/payment confirmation.
- Candidate and medical-office management.
- Notification templates (rich-text editor) with configurable SMTP, sent on case events.
- Message centre with resend support.
- SLA tracking and configurable SLA definitions per case event.
- Audit log of account and case actions.
- AES-256-GCM encryption at rest for sensitive fields, keyed by `APP_MASTER_KEY`.
- Session cookies with configurable inactivity timeout (`SESSION_TIMEOUT_MINUTES`).

## Environment variables

See `.env.example`. The application itself only reads:

- `APP_MASTER_KEY` — optional; a key is generated and persisted under `data/` if omitted.
- `COOKIE_SECURE` — set `true` in any real deployment (served over HTTPS).
- `SESSION_TIMEOUT_MINUTES` — inactivity timeout for authenticated sessions (5-480).
- `DATABASE_URL` — standard Prisma/Postgres connection string.

SMTP settings, notification templates, portal branding, and SLA definitions
are configured through the Settings admin UI and stored in the database, not
environment variables.

## Production checklist

Before using this with real medical data:

- Serve only over HTTPS and set `COOKIE_SECURE=true`.
- Store `APP_MASTER_KEY` in a managed secret vault, not in the project folder.
- Restrict database access by facility, reviewer group, and network policy where appropriate.
- Add secure backups, restore testing, retention rules, and deletion workflows.
- Complete legal/privacy review for applicable health-data and employment regulations.
- Run security testing before handling live records.
