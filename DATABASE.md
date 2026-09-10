# Database

Postgres, accessed via Prisma. `packages/database` owns the schema, migrations,
and repositories; `apps/web` never talks to Postgres directly.

- Schema: `packages/database/prisma/schema.prisma`
- Migrations: `packages/database/prisma/migrations/`
- Repositories: `packages/database/src/repositories/`

## Configuration

The only connection setting is `DATABASE_URL`, a standard Postgres connection
string:

```env
DATABASE_URL=postgresql://ncb_medical_app:<password>@<host>:5432/ncb_medical?schema=public
```

## Migrations

```bash
npm run db:migrate:dev      # create/apply a migration in local dev
npm run db:migrate:deploy   # apply pending migrations (CI, Docker, Render)
```

`docker-compose.yml` runs `db:migrate:deploy` in a one-shot `migrate` service
before the app starts. `render.yaml`'s `buildCommand` does the same during
deploy. `.github/workflows/ci.yml`'s `integration-tests` job runs it against
a real Postgres service container before running integration tests.

## Generating the Prisma client

`npm run db:generate` (or just `npm run build`, which runs it as part of
`packages/database`'s build step). Needed after pulling schema changes, and
run automatically in CI/Docker/Render builds.

## Security requirements

- Store `DATABASE_URL` (and its password) in a managed secret service, never in source control.
- Use a dedicated application database account — do not run as the database owner or administrator.
- Grant only the privileges the app actually needs after migrations are applied.
- Require TLS to any non-local database.
- Enable encrypted backups, point-in-time recovery, and tested restoration procedures.
- Keep database audit logs separate from the application's own audit events (`packages/database/src/repositories/audit.ts`) and protect both from modification.
- Define retention, legal hold, correction, breach response, and deletion policies with the organization's privacy and legal teams.
- Complete a Data Protection Impact Assessment before production processing.

This implementation supports technical safeguards but does not by itself
certify compliance with Jamaica's Data Protection Act. Legal review,
operational controls, staff access governance, incident response, and
processor agreements remain required.
