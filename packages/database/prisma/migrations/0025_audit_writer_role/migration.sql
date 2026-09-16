-- Grants the least-privileged ncb_audit_writer role (created by docker/postgres-init's own init
-- script — see its comment for the full reasoning) exactly the two privileges the audit repository
-- actually needs on this one table: INSERT (append) and SELECT (list/query/verifyChain). Nothing
-- else — not UPDATE, not DELETE, not access to any other table.
--
-- Guarded behind a role-existence check rather than assuming the role is always there: CI's
-- Testcontainers-based Postgres (and any other environment that provisions Postgres without this
-- project's own docker-compose.yml/init script) never creates ncb_audit_writer, and this migration
-- must not fail the whole migration run just because that optional hardening role is absent —
-- packages/database/src/client.ts's own createAuditPrismaClient() already falls back to the main
-- DATABASE_URL role when AUDIT_DATABASE_URL isn't set, so skipping this grant there is consistent,
-- not a silent gap.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ncb_audit_writer') THEN
    GRANT INSERT, SELECT ON audit_events TO ncb_audit_writer;
    GRANT USAGE ON SEQUENCE audit_events_id_seq TO ncb_audit_writer;
  END IF;
END
$$;
