# Tighter controls around a paid case — checklist

Triggered by testing the turnaround report: found that a reviewed-and-**paid** case could still be
sent back to the doctor or patient with no warning (`case-transitions.ts` never checked payment
status), and that there was no real way to fix a wrong payment date — only an undocumented
side-channel (flip "Payment status" back to unpaid on the billing form, which silently re-opened
the payment-confirmation form with no record it was a correction).

Policy decisions confirmed with the user: reopening a paid case is allowed for **admin and
reviewer** (not auditor/doctor/delegate); reopening or correcting a payment date both **require a
typed reason**, kept with the audit event.

## Database

- [x] Migration `0028_reset_payment_on_case_reopen`: `transition_medical_case` now also resets
      `payment_status`/`payment_confirmed_at` when a case moves to `sent_to_doctor`/
      `sent_to_patient` (previously only reset on reaching `doctor_submitted` or on
      withdraw/cancel) — a paid case being reworked shouldn't keep showing as paid. No-op for a
      case that wasn't paid yet.
- [x] Verified directly against the real dev Postgres (not just unit-mocked): confirmed a paid
      case reopened to `sent_to_doctor` correctly resets to `payment_status: 'unpaid'`,
      `payment_confirmed_at: null`, then restored the row to its prior state.

## Reopening a paid case

- [x] `case-transitions.ts`: `availableCaseActions`/`findCaseAction` take a new `isPaid` param. A
      reviewed **and paid** case is locked to exactly two moves — reopen to doctor, reopen to
      patient — both `requiresReason: true`, both restricted to admin/reviewer; no plain
      bounce-back, no cancel. An unpaid case (including merely `reviewed`) keeps the ordinary,
      reason-free moves.
- [x] `apply-case-action.ts`: derives `isPaid` from the case's own `paymentStatus`, requires a
      non-empty `reason` when the chosen action calls for one, threads it through to
      `transitionCase` → the `case_transition` audit event's `details.reason`.
- [x] `CaseActionsMenu`: the existing doctor-picker dialog now also handles `requiresReason` —
      shows a reason textarea, works whether or not the action also needs a doctor picked.
- [x] `case-history.ts`: appends the reason to a `case_transition` row's "to" column when one was
      given, so it shows up on the case's own History tab.

## Correcting a wrong payment date

- [x] `correctCasePaymentDate` (cases-service.ts) — re-runs the same DB write `confirmCasePayment`
      does (still `paid`, just a different date) but logs its own `case_payment_corrected` audit
      event (never `case_payment_confirmed` again) with the reason, and sends no notification —
      this is a paperwork fix, not a new payment event.
- [x] `correct-case-payment-date.ts` action, same `MEDICAL_CASES_PAYMENT_CONFIRM` permission as
      confirming payment in the first place, only allowed while the case is actually paid, reason
      required.
- [x] `CasePaymentDateCorrection` component — collapsed behind a "Correct payment date" link next
      to the read-only `CasePaymentSummary`, not shown as a second always-open form.
- [x] `staff-case-workspace.tsx`'s paidOn/confirmed-by lookup now matches either
      `case_payment_confirmed` or `case_payment_corrected` (most-recent-first), so a correction
      actually updates what's displayed.
- [x] New `case_payment_corrected` label in `audit-event-labels.ts` (History tab + full /audit log).

## Closing the side-channel

- [x] `case-workspace-capabilities.ts`: `billingLocked` now also true once `isPaid` — the billing
      amount/status form is disabled entirely once paid, with a message pointing at the reopen
      action or the payment-date correction instead.
- [x] `update-case-billing.ts` (the actual server-side enforcement, not just the UI's disabled
      state): rejects an edit outright once the case is paid.
- [x] `case-billing-panel.tsx`'s helper paragraph now reuses `billingLockedMessage` instead of a
      second, independently-maintained copy of the same three-way message.

## Verification

- [x] `npx tsc --noEmit` + `npx eslint .` on `apps/web` — both clean
- [x] Full `apps/web` suite: 945/945 tests passing, coverage above the 85% threshold on every
      metric
- [ ] Full authenticated click-through of the reopen and payment-correction flows — same 2FA-code
      wall as the reporting work; left for the user or a future session with a code relayed
      interactively
