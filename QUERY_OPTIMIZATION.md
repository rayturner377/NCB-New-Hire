# Query and Loading Optimization

## Implemented

- List endpoints enforce `limit`, `offset`, and `q`.
- Maximum API page size is 500 records.
- HR/admin case lists read the lightweight case-report index rather than decrypting every case.
- Full medical case payloads are loaded by ID only when a case workspace is opened.
- Patient, case, user, and medical-office management searches query the server.
- Database schemas include indexes for workflow status, billing status, patient history, office queues, clinician queues, submissions, attachments, and audit events.
- Database pools enforce connection and statement timeouts.

## Remaining encrypted-file scans

The compatibility file repositories still scan encrypted records for:

- Doctor and patient authorization-filtered case lists.
- Candidate lists before server-side pagination is applied.
- Submission lists before server-side pagination is applied.
- Monthly report aggregation.
- Demo-data reconciliation during startup.
- User deletion cleanup and historical preservation checks.

These scans are bounded at the browser/API response layer, but file storage cannot provide true indexed query execution. Removing them requires the controlled repository cutover from encrypted files to the SQL tables.

## Recommended cutover order

1. Users and medical offices.
2. Patient profiles.
3. Medical-case summaries and workflow state.
4. Encrypted case payloads and submissions.
5. Attachment metadata.
6. Audit events and settings.
7. Backfill verification, record counts, checksums, and rollback testing.
8. Switch reads to SQL, then writes, before retiring file storage.

Use dual-write and reconciliation during migration. Do not delete the encrypted file records until backup restoration and SQL record verification have passed.
