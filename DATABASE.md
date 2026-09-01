# Database Foundation

The application supports optional PostgreSQL, MySQL/MariaDB, and Google Cloud SQL connections. Standard PostgreSQL/MySQL settings also work with managed services such as AWS RDS and Azure Database when their TLS/network requirements are configured. Database mode is disabled by default, so existing local development continues to use the encrypted files under `data/`.

## Current integration stage

When `DATABASE_ENABLED=true`, the server:

1. Opens a bounded connection pool.
2. Verifies connectivity before accepting HTTP traffic.
3. Acquires a database advisory migration lock.
4. Validates migration checksums.
5. Creates or updates the database schema.
6. Refuses to start if connection or migration validation fails.

The current application repositories still read and write encrypted files. The SQL schema is the secure foundation for the next cutover phase, where user, patient, case, submission, attachment metadata, settings, and audit repositories will be moved behind database-backed interfaces. Do not delete the `data/` directory after enabling this phase.

## Configuration source

Administrators can select **Administration → System Settings → Database** and choose:

- **Environment variables**: recommended for production. Runtime secrets remain in the deployment secret manager and are never returned to the browser.
- **Encrypted system settings**: useful for controlled internal deployments. Passwords and TLS private keys are encrypted with `APP_MASTER_KEY` before being written to the settings file.

The Database screen supports connection testing and an explicit **Save and connect** action. A replacement pool is activated only after connection validation and migrations succeed. Existing connections remain active if validation fails.

Set `DATABASE_CONFIG_SOURCE=environment` or `DATABASE_CONFIG_SOURCE=settings` to enforce the startup source.

## Supported providers

### PostgreSQL

```env
DATABASE_ENABLED=true
DATABASE_PROVIDER=postgres
DATABASE_HOST=db.internal.example
DATABASE_PORT=5432
DATABASE_NAME=ncb_medical
DATABASE_USER=ncb_medical_app
DATABASE_PASSWORD=use-a-secret-manager
DATABASE_SSL_MODE=require
DATABASE_SSL_CA=-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----
```

### MySQL

```env
DATABASE_ENABLED=true
DATABASE_PROVIDER=mysql
DATABASE_HOST=db.internal.example
DATABASE_PORT=3306
DATABASE_NAME=ncb_medical
DATABASE_USER=ncb_medical_app
DATABASE_PASSWORD=use-a-secret-manager
DATABASE_SSL_MODE=require
DATABASE_SSL_CA=-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----
```

### Google Cloud SQL

Mount the Cloud SQL Auth Proxy or connector socket into the runtime:

```env
DATABASE_ENABLED=true
DATABASE_PROVIDER=cloudsql
CLOUDSQL_DIALECT=postgres
CLOUDSQL_SOCKET_PATH=/cloudsql/project:region:instance
DATABASE_NAME=ncb_medical
DATABASE_USER=ncb_medical_app
DATABASE_PASSWORD=use-a-secret-manager
```

Use `CLOUDSQL_DIALECT=mysql` for Cloud SQL for MySQL.

## Schema

Automatic migrations create:

- Users and role metadata.
- Patient profiles.
- Medical offices and office memberships.
- Medical cases with explicit workflow and billing states.
- Versioned medical submissions.
- Attachment metadata and malware-scan status.
- Encrypted application settings.
- Append-oriented audit events.
- Migration history with SHA-256 checksums.

Clinical/profile payload columns are binary and intended for application-level AES-256-GCM ciphertext. Searchable workflow metadata is stored separately and indexed.

## Performance

Indexes cover:

- Case status and last update.
- Patient case history.
- Medical-office and clinician queues.
- Billing status.
- Submission versions.
- Attachment lookup.
- Audit lookup by actor, entity, event type, and time.

Connection pool limits and statement timeouts are configurable. Keep pool size aligned with the database service connection limit and the number of application instances.

List APIs enforce a maximum page size of 500 and support `limit`, `offset`, and `q` query parameters. Case lists for HR/admin use the lightweight case index and load the full encrypted medical case only when it is opened.

## Security requirements

- Store database passwords and TLS private keys in a managed secret service, never `.env` in source control.
- Use a dedicated application database account. Do not run the application as database owner or administrator.
- Grant only `SELECT`, `INSERT`, `UPDATE`, and required procedure execution after migrations are applied.
- Use a separate migration identity for production deployments where possible.
- Require TLS or a protected Cloud SQL Unix socket.
- Restrict database ingress to the application network/service identity.
- Enable encrypted backups, point-in-time recovery, and tested restoration procedures.
- Avoid storing TRN or medical details as plain searchable values. Use keyed hashes for exact matching and encrypted payloads for source data.
- Keep database audit logs separate from application audit events and protect both from modification.
- Define retention, legal hold, correction, breach response, and deletion policies with the organization’s privacy and legal teams.
- Complete a Data Protection Impact Assessment before production processing.

This implementation supports technical safeguards but does not by itself certify compliance with Jamaica’s Data Protection Act. Legal review, operational controls, staff access governance, incident response, and processor agreements remain required.
