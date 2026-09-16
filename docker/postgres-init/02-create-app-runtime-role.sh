#!/bin/bash
# Runs once, automatically, only the first time this container starts against an empty data
# directory — see 01-create-audit-writer-role.sh's own comment for why (and for the general
# reasoning behind having any of these dedicated roles at all).
#
# Confirmed via external security review that ncb_audit_writer alone didn't actually separate audit
# history from a compromised main application credential: ncb_medical_app (POSTGRES_USER, what
# DATABASE_URL used to authenticate as for every runtime query) is a Postgres SUPERUSER — it created
# every table via migrations, so it owns them, and Postgres superusers/owners bypass REVOKE-based
# restriction entirely regardless of what's granted to any other role. Adding ncb_audit_writer did
# nothing to change what ncb_medical_app itself could still do.
#
# ncb_app_runtime is the actual fix for that: a genuinely non-superuser role, with only the
# CRUD privileges the running application needs on its ordinary business tables (see migration
# 0026_app_runtime_role) and explicitly NOT on audit_events. DATABASE_URL for the running app (the
# `web` service) now authenticates as this role instead of ncb_medical_app — ncb_medical_app is kept
# only as the migration/ownership credential (the `migrate` service), never used for a live runtime
# connection again. A compromise of the app's own day-to-day credential now has zero access to audit
# history at all, not even SELECT.
set -e

: "${APP_RUNTIME_DB_PASSWORD:?APP_RUNTIME_DB_PASSWORD must be set for the postgres container (see .env.example)}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
	DO \$\$
	BEGIN
	  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ncb_app_runtime') THEN
	    CREATE ROLE ncb_app_runtime WITH LOGIN PASSWORD '${APP_RUNTIME_DB_PASSWORD}';
	  END IF;
	END
	\$\$;

	GRANT CONNECT ON DATABASE "$POSTGRES_DB" TO ncb_app_runtime;
	GRANT USAGE ON SCHEMA public TO ncb_app_runtime;
EOSQL
