#!/bin/bash
# Runs once, automatically, only the first time this container starts against an empty data
# directory (Postgres's own /docker-entrypoint-initdb.d convention) — never re-runs against an
# already-initialized volume, so an existing dev/prod database needs this applied by hand once (see
# DATABASE.md).
#
# Creates a genuinely separate, least-privileged Postgres role for audit_events specifically.
# Confirmed via external security review that a plain REVOKE on the app's own role (ncb_medical_app)
# would do nothing — table OWNERS bypass REVOKE-based restriction entirely in Postgres, and
# ncb_medical_app both owns audit_events and is what every other query in this app runs as. Only a
# real, different role closes that gap: ncb_audit_writer can INSERT and SELECT on audit_events (see
# the 0025_audit_writer_role migration, which grants that once the table exists) and nothing else —
# a fully compromised main app credential is then physically incapable of deleting or altering
# existing audit history, not merely instructed not to.
set -e

: "${AUDIT_DB_PASSWORD:?AUDIT_DB_PASSWORD must be set for the postgres container (see .env.example)}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
	DO \$\$
	BEGIN
	  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ncb_audit_writer') THEN
	    CREATE ROLE ncb_audit_writer WITH LOGIN PASSWORD '${AUDIT_DB_PASSWORD}';
	  END IF;
	END
	\$\$;

	GRANT CONNECT ON DATABASE "$POSTGRES_DB" TO ncb_audit_writer;
	GRANT USAGE ON SCHEMA public TO ncb_audit_writer;
EOSQL
