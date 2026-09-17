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
- The three main list pages — `/cases` (All cases tab), `/candidates`, and the role list pages
  (`/doctors`, `/reviewers`, `/admins`, `/auditors`, `/delegates`) — all filter, search, and
  paginate in SQL (`casesRepository.searchWithPatient`, `candidatesRepository.search`,
  `usersRepository.search`), decrypting only the page actually returned rather than every row in
  the table. Candidates' `status`/`position` fields are mirrored as plain columns
  (`patient_profiles`, migration `0027_candidate_status_position_columns`) specifically so this
  list didn't have to choose between real pagination and filtering on encrypted fields; each
  page's stat cards (`getUserRoleStats`, `getCandidateStats`) and per-row case counts come from
  dedicated `count()`/`_count` queries rather than fetching full row sets to measure them.
- Database connection pooling is Prisma's own default (one pool per `PrismaClient` instance,
  reused via the singleton in `packages/database/src/client.ts` rather than recreated per request).

## Known gap: single-detail decrypt, and unbounded aggregate reads elsewhere

Opening one case, candidate, or user (not a list — a single record) still decrypts just that one
row, which is the right tradeoff (a payload column has to be decrypted to be read at all, and
Postgres can't index inside an `AES-256-GCM` blob).

A few call sites still read the *whole* table for a reason other than a paginated list: the
reviewer/admin dashboard's aggregate counts, the org-wide billing report, and the audit log's
case-name lookups all call `listCasesWithPatient()`/`listCandidates()` in full. This is an
accepted tradeoff for now — these are single aggregate reads per page load, not per-row decrypt
multiplied by page size — but the same pattern used for the list pages above (push the filter into
SQL, decrypt only what's needed) would apply if any of them become a real bottleneck.
