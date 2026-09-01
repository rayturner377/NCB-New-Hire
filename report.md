# Medical System Reporting Enhancement Prompt

## Objective

Enhance the existing Medical System by adding a secure, useful reporting module for HR users. The most important report is a **Doctor/Medical Office Payment Report** that calculates how much each doctor or medical office should be paid over a selected period based on completed/processed medicals.

Do not remove or break any existing functionality. Follow the current application structure, naming conventions, routes, controllers, models, views, middleware, and styling patterns already in the project.

---

## System Context

The system supports medical onboarding for new hires.

### Main user types

* HR Officer
* Patient / Candidate / New Hire
* Doctor
* Clinical Assistant
* Admin, if already supported

### Medical workflow

1. HR Officer creates a user.
2. User type may be Doctor, Patient, or Clinical Assistant.
3. HR Officer creates a medical case and assigns it to a patient.
4. Patient completes their sections of the medical form.
5. Patient submits the medical to a selected medical office / doctor.
6. Doctor or medical office completes the assessment.
7. Doctor submits the medical back to HR.
8. HR reviews the medical.
9. Once HR completes the review, the medical case is considered completed.
10. HR can update the payment status to `Paid` or `Unpaid`.

---

## Core Reporting Requirement

Create or enhance a reporting area for HR/Admin users.

### Must-have report: Doctor / Medical Office Payment Report

The report should allow HR to determine how much each doctor or medical office should be paid for a selected period.

### Filters

Include filters where possible based on the existing database fields:

* Start date
* End date
* Doctor
* Medical office
* Payment status: Paid, Unpaid, All
* Medical status: Completed, Reviewed, Submitted to HR, or equivalent existing statuses
* Patient name or staff/candidate number, if available

### Date logic

Use the most appropriate date field based on the existing schema.

Preferred order:

1. HR review completed date
2. Doctor submitted date
3. Medical completed date
4. Updated date, only if no better field exists

The report should count medicals processed within the selected date range.

### Payment calculation

Look for an existing fee/rate field for doctors or medical offices.

If a rate field exists:

* Calculate `total_payable = number_of_medicals * rate`.

If no rate field exists:

* Add a safe configurable payment rate field if it fits the existing architecture, preferably on the doctor profile or medical office record.
* If there is no medical office table, document the best current place to store the rate and implement the least disruptive solution.

The report should show:

* Doctor name
* Medical office name, if available
* Number of medicals processed
* Rate per medical
* Total amount payable
* Number paid
* Number unpaid
* Paid total
* Unpaid total
* Date range used

### Drill-down details

Allow HR to view the list of medicals included in each doctor/office total.

The detail view/table should include:

* Medical/case ID
* Patient name
* Candidate/staff number, if available
* Doctor
* Medical office
* Doctor submitted date
* HR reviewed/completed date
* Payment status
* Amount
* Current medical status

---

## Other Useful Reports

If reporting already exists, enhance it. If not, add a clean reporting dashboard with these report sections if practical:

### 1. Medical Status Summary

Shows counts by medical status:

* Draft / Created
* Assigned to patient
* Submitted to doctor
* In doctor review
* Submitted to HR
* HR reviewed / completed
* Cancelled / rejected, if applicable

Filters:

* Date range
* HR officer
* Doctor/office
* Status

### 2. Pending Medicals Report

Shows medicals not yet completed.

Include:

* Patient name
* Assigned date
* Current status
* Days pending
* Responsible party: Patient, Doctor, HR
* Doctor/office, if already selected

### 3. Doctor Turnaround Time Report

Shows how long doctors take to process medicals.

Calculate:

* Patient submitted to doctor date
* Doctor submitted to HR date
* Number of days/hours taken

Group by:

* Doctor
* Medical office

Show:

* Average turnaround time
* Minimum turnaround time
* Maximum turnaround time
* Count of medicals processed

### 4. HR Review Turnaround Report

Shows how long HR takes to complete review after doctor submission.

Calculate:

* Doctor submitted to HR date
* HR completed/reviewed date
* Number of days/hours taken

### 5. Payment Status Report

Shows paid/unpaid medicals.

Include:

* Doctor/office
* Patient
* Medical ID
* Amount
* Payment status
* Payment updated by
* Payment updated date

---

## UI/UX Requirements

Create a clean reporting interface that is easy for HR to use.

Suggested structure:

* Reports landing page/dashboard
* Report cards for each available report
* Filter section at the top of each report
* Results table below
* Summary cards above the table
* Export buttons where practical

### Summary cards for Payment Report

Include cards such as:

* Total medicals processed
* Total payable
* Total paid
* Total unpaid
* Number of doctors/offices included

### Export options

Add export options if the existing project supports them:

* CSV export
* Excel export, if already available
* PDF export, only if a PDF library already exists

Do not add large new dependencies unless absolutely necessary.

---

## Security and Access Control

Only authorized HR/Admin users should access reports.

Check the existing authentication and role/permission system before implementing.

Requirements:

* Protect all report routes.
* Do not allow patients to access reports.
* Do not allow doctors to view payment information for other doctors unless the existing business rules allow it.
* Sanitize and validate all filter inputs.
* Use prepared statements / parameterized queries.
* Avoid exposing sensitive medical details in summary reports.
* Only show detailed medical information where appropriate for HR/Admin users.

---

## Database and Code Instructions

Before making changes:

1. Inspect the existing database schema/models/migrations.
2. Identify existing tables for users, medicals, doctors, medical offices, statuses, payments, and audit logs.
3. Reuse existing columns where possible.
4. Do not create duplicate fields if suitable fields already exist.
5. Keep changes minimal and compatible with the existing codebase.

If new fields are needed, suggest and implement safe migrations or SQL scripts.

Possible fields that may be needed if missing:

* doctor_id
* medical_office_id
* doctor_submitted_at
* hr_reviewed_at
* completed_at
* payment_status
* payment_amount
* payment_rate
* payment_updated_by
* payment_updated_at

Only add what is necessary.

---

## Suggested Output / Deliverables

Implement or provide:

1. Report routes.
2. Report controller methods.
3. Report model/query methods.
4. Report views/pages.
5. Payment report with filters and totals.
6. Drill-down details for payment totals.
7. CSV export if practical.
8. Access control checks.
9. Any required database migration or SQL update script.
10. Clear comments where business logic is applied.

---

## Important Business Rules

* A medical should only count for payment once it has been processed by the doctor and submitted back to HR, or after HR has reviewed/completed it, depending on available statuses.
* Do not count draft, cancelled, deleted, or incomplete medicals.
* Payment status should not affect whether the medical appears in the payable report; it should affect whether it appears as paid or unpaid.
* The date range should be inclusive of the selected start and end dates.
* If using SQL, handle the end date as `< end_date + 1 day` to include the full end date.
* If data is missing, display `N/A` rather than breaking the report.

---

## Quality Expectations

* Preserve all existing functionality.
* Follow the current MVC/project structure.
* Keep the implementation simple and maintainable.
* Avoid unnecessary packages.
* Use clear function names.
* Add comments for payment calculation and date logic.
* Ensure the report works even when filters are blank.
* Ensure empty results show a helpful message instead of an error.
* Keep styling consistent with the existing system.
