# Database

Postgres, accessed via Prisma. `packages/database` owns the schema, migrations,
and repositories; `apps/web` never talks to Postgres directly.

- Schema: `packages/database/prisma/schema.prisma`
- Migrations: `packages/database/prisma/migrations/`
- Repositories: `packages/database/src/repositories/`

## Configuration

Three Postgres roles, each with a different job — see "Security requirements" below for why one
role doing all three would defeat the point of having any of them:

- **`ncb_medical_app`** (`DATABASE_URL`) — the migration/ownership role. A Postgres superuser; it
  created every table via migrations, so it owns them. Used by Prisma CLI commands (`migrate
  deploy`/`dev`, `generate`) wherever they run, and — for convenience only — by local `npm run dev`
  when not going through docker-compose's own `web` service.

  ```env
  DATABASE_URL=postgresql://ncb_medical_app:<password>@<host>:5432/ncb_medical?schema=public
  ```

- **`ncb_app_runtime`** (`APP_RUNTIME_DB_PASSWORD`, optional) — the deployed app's actual live
  runtime credential. Non-superuser, ordinary CRUD on every business table, explicitly **none** on
  `audit_events`. Used only by docker-compose's `web` service (its own `DATABASE_URL` override
  points here, not at `ncb_medical_app`) — omit and that service falls back to failing loudly
  instead (the env var is required there), since silently reusing the superuser role for a real
  deployment is exactly what this role exists to prevent.

- **`ncb_audit_writer`** (`AUDIT_DATABASE_URL`, optional) — INSERT+SELECT on `audit_events` only,
  nothing else. Points `packages/database/src/repositories/audit.ts` at a role genuinely separate
  from both of the above. Omitting it falls back to the main `DATABASE_URL` role with a console
  warning — acceptable for quick local dev, not for a real deployment.

Both `ncb_app_runtime` and `ncb_audit_writer` are created automatically by `docker/postgres-init`'s
init scripts on a fresh Postgres volume (a data directory Postgres is initializing for the first
time); an already-initialized database needs the same `CREATE ROLE`/`GRANT` statements applied by
hand once (see those scripts and migrations `0025_audit_writer_role`/`0026_app_runtime_role`).

## Migrations

```bash
npm run db:migrate:dev      # create/apply a migration in local dev
npm run db:migrate:deploy   # apply pending migrations (CI, Docker, production)
```

`docker-compose.yml` runs `db:migrate:deploy` in a one-shot `migrate` service
before the app starts — the same explicit-step approach any other deployment
onto the organization's infrastructure should follow, rather than running
migrations on every app start. `.github/workflows/ci.yml`'s `integration-tests`
job runs it against a real Postgres service container before running
integration tests.

## Generating the Prisma client

`npm run db:generate` (or just `npm run build`, which runs it as part of
`packages/database`'s build step). Needed after pulling schema changes, and
run automatically in CI/Docker builds.

## Security requirements

- Store `DATABASE_URL` (and its password) in a managed secret service, never in source control.
- Use a dedicated application database account — do not run as the database owner or administrator.
- Grant only the privileges the app actually needs after migrations are applied.
- Require TLS to any non-local database.
- Enable encrypted backups, point-in-time recovery, and tested restoration procedures.
- Keep database audit logs separate from the application's own audit events (`packages/database/src/repositories/audit.ts`) and protect both from modification.
- Confirmed via external security review: a plain `REVOKE` on the main application role does **not** protect `audit_events` from that same role, since Postgres table owners bypass `REVOKE`-based restriction entirely, and `ncb_medical_app` owns every table it created via migrations — including, critically, that adding `ncb_audit_writer` alone doesn't remove `ncb_medical_app`'s own unrestricted access, since that role stays a superuser regardless of what's granted to any other role. Two separate fixes close this: `AUDIT_DATABASE_URL` (see "Configuration" above) routes audit reads/writes through the genuinely separate, least-privileged `ncb_audit_writer` role; `APP_RUNTIME_DB_PASSWORD` stops the deployed app's own live queries from authenticating as the superuser at all, using non-superuser `ncb_app_runtime` (no access to `audit_events`, not even to read it) instead — `ncb_medical_app` is then used only for migrations, never for a live runtime connection. A compromise of the app's actual running credential is now physically unable to touch audit history, not merely instructed not to. The same review also found that `verifyChain()`'s hash-chain check alone can't detect deletion of the newest events or a fully wiped table (everything remaining still looks internally consistent) — it's now cross-checked against an independent checkpoint recorded in Redis on every append (itself hardened against being advanced over undetected tampering, or applied out of order under concurrent appends), which a Postgres-only compromise can't retroactively rewrite.
- Define retention, legal hold, correction, breach response, and deletion policies with the organization's privacy and legal teams.
- Complete a Data Protection Impact Assessment before production processing.

This implementation supports technical safeguards but does not by itself
certify compliance with Jamaica's Data Protection Act. Legal review,
operational controls, staff access governance, incident response, and
processor agreements remain required.
