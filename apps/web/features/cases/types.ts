/** Ported from server.js CASE_ROUTES/CASE_STATUSES (~L291-306). */
export type CaseRoute = 'patient' | 'doctor';

export type CaseStatus =
  | 'draft'
  | 'sent_to_patient'
  | 'patient_completed'
  | 'sent_to_doctor'
  | 'doctor_submitted'
  | 'canceled_by_doctor'
  | 'review_pending'
  | 'reviewed'
  | 'archived'
  | 'withdrawn';
