# CSV export + HR review turnaround report — checklist

Closes two items from `report.md`'s "Not implemented" list: no CSV/Excel/PDF export of any
report, and no standalone HR-review-turnaround report (only an org-wide average existed on the
reviewer dashboard).

Scope for this pass (confirmed with the user): CSV export (not Excel/PDF) for the doctor billing
report, the organization billing report, and the new HR turnaround report; the HR-review-turnaround
report itself. Per-doctor turnaround report and medical-office-level billing grouping are
explicitly out of scope for this branch.

## CSV export

- [ ] `apps/web/lib/csv.ts` — small generic `toCsv(headers, rows)` serializer (RFC 4180 quoting),
      unit tested
- [ ] `apps/web/app/(app)/billing/export/route.ts` — GET route handler, same role dispatch as
      `billing/page.tsx` (clinician → their own report, else `REPORTS_VIEW`-gated org report),
      same filters as the page, exports every matching row (not just the current page)
- [ ] "Export CSV" action button on `BillingReport`/`OrganizationBillingReport` (SectionCard's
      `action` slot), linking to the export route with the current filters in the query string
- [ ] Route handler unit tests (session/permission checks, CSV content, filename)

## HR review turnaround report

- [ ] `getHrReviewTurnaroundReport(filters)` service — reviewed/archived cases only, turnaround =
      `reviewedAt - doctorSubmittedAt` in days per case; average/min/max + per-case rows
- [ ] `apps/web/features/reports/` — container + presentational component + table (mirrors the
      billing report's own structure: stat cards, filters, table, pagination)
- [ ] `apps/web/app/(app)/reports/hr-turnaround/page.tsx`, gated by `REPORTS_VIEW`
- [ ] `apps/web/app/(app)/reports/hr-turnaround/export/route.ts` — CSV export, same permission gate
- [ ] Nav entry (`lib/nav-config.ts`), visible to admin/reviewer/auditor
- [ ] Service + container + route handler unit tests

## Wrap-up

- [ ] Update `report.md`'s "Implemented"/"Not implemented" split to match reality
- [ ] `npx turbo run typecheck lint test test:coverage`
- [ ] Manual check via `npm run dev`: both CSV downloads open correctly in a spreadsheet app, HR
      turnaround report's numbers match a hand-checked case
