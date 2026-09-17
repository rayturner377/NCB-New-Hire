# Query and Loading Optimization

Current state of the Postgres/Prisma system (`packages/database`), verified against the actual
repositories and schema — not the old pre-rewrite file-based system this document originally
described, which no longer exists anywhere in this codebase.

## In place today

- Targeted indexes for every hot query path: workflow status, billing/payment status, patient
  case history, office queues, clinician queues, submission versions, attachment listings, and
  audit-event lookups (`packages/database/prisma/schema.prisma`'s `@@index` declarations).
- The full `/audit` log and the Message Centre paginate server-side (`getAuditLog`,
  `listMessages` — page/pageSize params straight through to a Prisma `skip`/`take` query), rather
  than fetching everything and slicing in the browser.
- Database connection pooling is Prisma's own default (one pool per `PrismaClient` instance,
  reused via the singleton in `packages/database/src/client.ts` rather than recreated per request).

## Known gap: whole-table decrypt-and-scan lists

Case, candidate, and user listings (`listCasesWithPatient`, `listCandidates`, `listUsers` in
`packages/database/src/repositories`) fetch every row for the resource and — for cases and
candidates — decrypt every row's encrypted payload, with filtering/search applied afterward in the
container/UI layer rather than in the SQL query itself. This is the same tradeoff the rest of the
schema's encryption-at-rest design accepts (see `ARCHITECTURE.md`'s Data Storage section): a
payload column has to be decrypted to be searched, and Postgres can't index inside an
`AES-256-GCM` blob.

This is fine at the org's actual data volumes today, but doesn't scale indefinitely. If listing
performance becomes a real problem:

1. Add server-side pagination (`limit`/`offset` or keyset) to `listCasesWithPatient`,
   `listCandidates`, and `listUsers`, matching the pattern `getAuditLog`/`listMessages` already use.
2. For search-by-name specifically, either move the searchable fields (name, employee ID) to their
   own indexed, unencrypted columns — several already are (see `PatientProfile`'s `email`/
   `employeeId` indexes) — or decrypt only a bounded page at a time instead of the whole table.
3. Re-measure before adding either: the SQL migration already removed the previous system's
   biggest cost (no more per-request encrypted-file directory scans), and further optimization work
   should be driven by an actual observed slow query, not a hypothetical one.
