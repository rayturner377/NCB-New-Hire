import { PERMISSIONS } from './permissions';

/** Short, plain-English explanations for the Settings -> Permissions matrix's tooltips — static text, so showing one costs nothing beyond mounting a Radix Tooltip (see permissions-matrix.tsx's hover delay). */
export const PERMISSION_DESCRIPTIONS: Partial<Record<string, string>> = {
  [PERMISSIONS.SUBMISSIONS_LIST]: 'See the list of doctor assessment submissions.',
  [PERMISSIONS.SUBMISSIONS_CREATE]: 'Start a new assessment submission for an assigned case.',
  [PERMISSIONS.SUBMISSIONS_VIEW]: "Open a submission's full details.",
  [PERMISSIONS.SUBMISSIONS_FOLLOW_UP]: 'Add a follow-up note to a submission after it was sent in.',
  [PERMISSIONS.SUBMISSIONS_REVIEW]: "Mark a doctor's submission as reviewed.",
  [PERMISSIONS.MEDICAL_CASES_LIST]: 'See the case list and open any case for viewing.',
  [PERMISSIONS.MEDICAL_CASES_CREATE]: 'Start a brand-new case.',
  [PERMISSIONS.MEDICAL_CASES_UPDATE]: "Edit a case's own details (not its billed amount).",
  [PERMISSIONS.MEDICAL_CASES_BILLING_UPDATE]: 'Change what a case is billed for.',
  [PERMISSIONS.MEDICAL_CASES_PAYMENT_CONFIRM]: 'Mark a case as paid, removing it from the review queue.',
  [PERMISSIONS.MEDICAL_CASES_TRANSITION]: 'Move a case forward or back a stage via "Case actions".',
  [PERMISSIONS.MEDICAL_CASES_REASSIGN]: 'Change which doctor a case is assigned to.',
  [PERMISSIONS.MEDICAL_CASES_HIDE]: 'Hide a case from the doctor/patient queues without canceling it.',
  [PERMISSIONS.MEDICAL_CASES_PATIENT_UPDATE]: 'Edit a case as the patient it belongs to.',
  [PERMISSIONS.MEDICAL_CASES_ATTACH]: 'Upload documents/attachments to a case.',
  [PERMISSIONS.PATIENT_PROFILES_LIST]: 'Browse the full candidate/patient roster.',
  [PERMISSIONS.PATIENT_PROFILES_CREATE]: 'Add a new candidate/patient profile.',
  [PERMISSIONS.PATIENT_PROFILES_UPDATE]: "Edit a candidate/patient's own profile details.",
  [PERMISSIONS.PATIENT_PROFILES_RESET_PASSWORD]: "Send a password-reset code to a candidate's portal account.",
  [PERMISSIONS.DOCTORS_LIST]: 'See the list of doctor accounts.',
  [PERMISSIONS.MEDICAL_OFFICES_LIST]: 'See the list of medical facilities doctors are assigned to.',
  [PERMISSIONS.MEDICAL_OFFICES_CREATE]: 'Add a new medical facility.',
  [PERMISSIONS.REVIEWERS_LIST]: 'See the list of reviewer (HR) accounts.',
  [PERMISSIONS.AUDITORS_LIST]: 'See the list of auditor accounts.',
  [PERMISSIONS.REPORTS_VIEW]: 'View the billing/case reports.',
  [PERMISSIONS.NOTIFICATIONS_MANAGE]: 'View the Message Centre and resend a failed email — already includes plain viewing, so "view" below is redundant once this is checked.',
  [PERMISSIONS.NOTIFICATIONS_VIEW]: 'View the Message Centre — read-only, no resending.',
  [PERMISSIONS.STAFF_ACCOUNTS_MANAGE]: 'Create, edit, deactivate, or delete doctor/reviewer/auditor accounts (never admin accounts).',
  [PERMISSIONS.AUDIT_LOG_VIEW]: "See the system's audit log of who changed what."
};
