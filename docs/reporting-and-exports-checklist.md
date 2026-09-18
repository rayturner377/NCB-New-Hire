# Reporting, exports, and the Reports nav group — checklist

Started as two items from `report.md`'s "Not implemented" list (CSV export, a standalone
HR-review-turnaround report). Expanded after review to: CSV **and Excel** export everywhere a
report already exists (including the "All cases" list, which had no export at all); a generalized
**Turnaround** report (pick any two case-lifecycle milestones, not just doctor-submitted → HR
reviewed) in place of the original HR-only report; and a "Reports" nav group housing Billing
report + Turnaround, mirroring the existing "Users" group pattern.

Per-doctor turnaround report and medical-office-level billing grouping are still explicitly out of
scope for this branch.

## CSV export (first pass)

- [x] `apps/web/lib/csv.ts` — small generic `toCsv(headers, rows)` serializer (RFC 4180 quoting),
      unit tested
- [x] `apps/web/app/(app)/billing/export/route.ts` — GET route handler, same role dispatch as
      `billing/page.tsx` (clinician → their own report, else `REPORTS_VIEW`-gated org report)
- [x] "Export CSV" action button on `BillingReport`/`OrganizationBillingReport`

## Excel export + all-cases export (second pass)

- [x] `exceljs` added to `apps/web/package.json` (real .xlsx workbooks, not CSV wearing a `.xlsx`
      name). Note: pulls in a moderate `npm audit` advisory via its `uuid` dependency
      (GHSA-w5hq-g745-h8pq, a buffer-bounds issue when a caller supplies its own buffer to
      `uuid.v3/v5/v6`) — not exploitable here, exceljs only ever calls it with no arguments for
      internal id generation, we never pass it any buffer ourselves.
- [x] `apps/web/lib/xlsx.ts` — `toXlsxBuffer(sheetName, headers, rows)`, bold header row,
      auto-sized (capped) columns, unit tested including a real load-it-back-and-read round trip
- [x] `apps/web/components/dashboard/export-buttons.tsx` — shared CSV+Excel button pair, used by
      every report/list below instead of a one-off "Export CSV" link each
- [x] `casesRepository.searchAllWithPatient` / `searchAllCasesWithPatient` — the unpaginated
      equivalent of the existing `searchWithPatient`, for "give me every row I filtered to"
- [x] `apps/web/app/(app)/cases/export/route.ts` — CSV/Excel export for the "All cases" tab, same
      role/permission gate as `cases-container.tsx`
- [x] `billing/export` and `reports/turnaround/export` retrofitted to also serve `format=xlsx`
- [x] Route handler unit tests for every export route, both formats, including a "first two bytes
      are PK" check that the .xlsx is a real zip container, not just a renamed CSV

## Turnaround report — generalized from HR-only

- [x] `apps/web/features/reports/case-milestones.ts` — the six case lifecycle timestamps that
      actually exist on `MedicalCase` (created, patient submitted, reached doctor, doctor
      submitted, HR reviewed, payment confirmed), in canonical order
- [x] `getCaseTurnaroundReport(filters)` (renamed from `getHrReviewTurnaroundReport`) — turnaround
      between any `fromMilestone`/`toMilestone` pair, defaulting to the original doctor-submitted →
      HR-reviewed scope when neither is given; a case missing either endpoint, or with them out of
      order (data anomaly), is excluded rather than shown with a bogus duration
- [x] `TurnaroundReportFilters` — "From"/"To" milestone pickers; "To" only ever offers milestones
      at or after "From" in the canonical order, so a backwards turnaround can't be selected
- [x] Route/page/nav path renamed `hr-turnaround` → `turnaround` throughout
- [x] Service + route handler + case-milestones unit tests

## Reports nav group

- [x] `lib/nav-config.ts`: "Billing report" (top-level) + "Turnaround" replaced with a "Reports"
      group (mirrors the "Users" group's own "non-navigable group header, real href only on its
      children" pattern), same per-child role scoping as before
- [x] nav-config unit test updated for the new group shape

## Wrap-up

- [x] `npx tsc --noEmit` + `npx eslint .` on `apps/web` — both clean
- [x] Full `apps/web` suite: 922/922 tests passing, coverage above the 85% threshold on every
      metric
- [x] Update `report.md`'s "Implemented" section to describe Turnaround (not HR-review-turnaround)
      and the new CSV/Excel export coverage
- [ ] Full authenticated click-through (still blocked, as before, by the 2FA device-verification
      code requirement on a fresh browser session and the environment's deliberate redaction of
      live OTP codes from tool output) — left for the user or a future session with a code relayed
      interactively
