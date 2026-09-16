# Database

Postgres, accessed via Prisma. `packages/database` owns the schema, migrations,
and repositories; `apps/web` never talks to Postgres directly.

- Schema: `packages/database/prisma/schema.prisma`
- Migrations: `packages/database/prisma/migrations/`
- Repositories: `packages/database/src/repositories/`

## Configuration

The main connection setting is `DATABASE_URL`, a standard Postgres connection
string:

```env
DATABASE_URL=postgresql://ncb_medical_app:<password>@<host>:5432/ncb_medical?schema=public
```

A second, optional `AUDIT_DATABASE_URL` points `packages/database/src/repositories/audit.ts` at a
genuinely separate, least-privileged role (`ncb_audit_writer`, INSERT+SELECT on `audit_events`
only) instead of the main `ncb_medical_app` role — see "Security requirements" below for why. Created
automatically by `docker/postgres-init`'s init script on a fresh Postgres volume (a data directory
Postgres is initializing for the first time); an already-initialized database needs the same
`CREATE ROLE`/`GRANT` statements applied by hand once (see that script and migration
`0025_audit_writer_role`). Omitting `AUDIT_DATABASE_URL` falls back to the main `DATABASE_URL` role
with a console warning — acceptable for quick local dev, not for a real deployment.

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
- Confirmed via external security review: a plain `REVOKE` on the main application role does **not** protect `audit_events` from that same role, since Postgres table owners bypass `REVOKE`-based restriction entirely, and the main role owns the table it created via migrations. Set `AUDIT_DATABASE_URL` (see "Configuration" above) so audit writes go through the genuinely separate, least-privileged `ncb_audit_writer` role instead — a compromised main application credential is then physically unable to delete or alter existing audit history, not merely instructed not to. The same review also found that `verifyChain()`'s hash-chain check alone can't detect deletion of the newest events or a fully wiped table (everything remaining still looks internally consistent) — it's now cross-checked against an independent checkpoint recorded in Redis on every append, which a Postgres-only compromise can't retroactively rewrite.
- Define retention, legal hold, correction, breach response, and deletion policies with the organization's privacy and legal teams.
- Complete a Data Protection Impact Assessment before production processing.

This implementation supports technical safeguards but does not by itself
certify compliance with Jamaica's Data Protection Act. Legal review,
operational controls, staff access governance, incident response, and
processor agreements remain required.
