# Reporting

Originated as a feature request for a Doctor/Medical Office Payment Report; the request's full
original text is kept below for context. This section reflects what's actually built today,
verified against the code.

## Implemented

- **Doctor billing report** (`/billing`, `apps/web/features/billing/services/billing-report-service.ts`'s
  `getDoctorBillingReport`) — a doctor's own processed cases within a date range, with paid/
  outstanding totals and a case-level row list (patient, position, status, dates, amount).
- **Organization billing report** (`getOrganizationBillingReport`) — the HR/admin equivalent:
  org-wide by default with a per-doctor summary table (paid/outstanding/cases-processed per
  doctor), or drills into one doctor's own case-level rows when selected. Filterable by financial
  year, doctor, payment status, and date range.
- **Reviewer/admin dashboard counts** (`apps/web/features/dashboard/services/reviewer/reviewer-dashboard-service.ts`) —
  open cases, awaiting-patient/with-doctor/HR-review counts, an org-wide average case-creation-to-
  HR-review turnaround, outstanding billing total, and a recent-activity feed sourced from the
  audit log.
- **Audit log** (`/audit`) — filterable, paginated log of every case/user/settings/session event,
  independently of the billing/dashboard reports.

## Not implemented

These were part of the original request below but don't exist today — noted here so this document
doesn't imply they do:

- A dedicated per-doctor turnaround-time report (min/max/average, grouped by doctor or office).
- A standalone HR-review-turnaround report (only the org-wide average above exists).
- A standalone "pending medicals" report (the reviewer dashboard's queue counts cover similar
  ground but aren't a dedicated report page).
- CSV/Excel/PDF export of any report (case-level attachments have their own PDF export, unrelated
  to reporting).
- Medical-office-level grouping in the billing report (grouping is per-doctor only).

---

## Original request

The text below is the original feature-request prompt this work was scoped from, kept verbatim for
historical context — it predates this codebase's actual structure (references to "controllers",
"models", "MVC" don't apply to this Next.js/Prisma app) and should be read as intent, not as an
accurate description of how to implement it here.

### Objective

Enhance the existing Medical System by adding a secure, useful reporting module for HR users. The
most important report is a **Doctor/Medical Office Payment Report** that calculates how much each
doctor or medical office should be paid over a selected period based on completed/processed
medicals.

### Core reporting requirement

Filters: start date, end date, doctor, medical office, payment status, medical status, patient
name/staff number. Date logic prefers HR-review-completed date, then doctor-submitted date, then
medical-completed date, then updated date. Payment calculation: `total_payable = number_of_medicals
* rate`, using an existing or newly-added rate field. Report output: doctor name, medical office
name, number processed, rate, total payable, number paid/unpaid, paid/unpaid totals, date range
used. Drill-down: medical/case ID, patient name, candidate/staff number, doctor, medical office,
doctor-submitted date, HR-reviewed date, payment status, amount, current status.

### Other requested reports

Medical Status Summary, Pending Medicals Report, Doctor Turnaround Time Report, HR Review
Turnaround Report, Payment Status Report — see "Not implemented" above for current status of each.

### Business rules

A medical should only count for payment once processed by the doctor and submitted back to HR (or
reviewed/completed, depending on available statuses). Exclude draft, cancelled, deleted, or
incomplete medicals. Payment status affects paid/unpaid classification, not whether a medical
appears in the payable report at all. Date ranges are inclusive of both endpoints. Missing data
should display `N/A` rather than break the report.
