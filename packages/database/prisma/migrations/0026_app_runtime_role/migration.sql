-- Grants the non-superuser ncb_app_runtime role (created by docker/postgres-init's own init
-- script — see its comment for the full reasoning) ordinary CRUD on every business table EXCEPT
-- audit_events, which stays reachable only through ncb_audit_writer's own separate connection
-- (packages/database/src/client.ts's auditPrisma). This is what actually separates the running
-- application's day-to-day credential from the migration/ownership one (ncb_medical_app, a
-- superuser that owns every table) — DATABASE_URL for the `web` service now authenticates as this
-- role instead, so a compromise of the app's own live credential can't reach audit history at all,
-- not even to read it.
--
-- Guarded behind a role-existence check for the same reason 0025_audit_writer_role is: CI's
-- Testcontainers-based Postgres (and any environment provisioning Postgres without this project's
-- own docker-compose.yml/init scripts) never creates ncb_app_runtime, and this migration must not
-- fail the whole migration run just because that optional hardening role is absent.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ncb_app_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ncb_app_runtime;
    REVOKE ALL ON audit_events FROM ncb_app_runtime;

    -- Future tables (created by ncb_medical_app, the owning role every migration runs as) grant to
    -- ncb_app_runtime automatically — a table as sensitive as audit_events would need its own
    -- explicit REVOKE in its own migration, the same way this one does, rather than relying on
    -- someone remembering to update this file.
    ALTER DEFAULT PRIVILEGES FOR ROLE ncb_medical_app IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ncb_app_runtime;
  END IF;
END
$$;
