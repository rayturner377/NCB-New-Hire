/**
 * Loose, unvalidated shape of a doctor assessment draft (see
 * CasePayload.doctorAssessmentDraft) — mirrors createSubmissionSchema's
 * field groupings so a draft's field names match what the real submit posts,
 * but nothing here is required or type-checked the way the schema is; a
 * draft can be missing, partial, or have any string values in it.
 */
export interface AssessmentDraft {
  facilityName?: string;
  facilityAddress?: string;
  assessmentDate?: string;
  clinicianName?: string;
  clinicianRegistrationNumber?: string;
  telephoneNumber?: string;
  faxNumber?: string;
  emailAddress?: string;
}

export interface DeterminationDraft {
  status?: string;
  conclusions?: string;
  restrictions?: string;
  recommendation?: string;
  followUpDate?: string;
}

export interface AttestationDraft {
  signedBy?: string;
  signatureDate?: string;
  signatureDataUrl?: string;
  consentConfirmed?: string | boolean;
}

export interface DoctorAssessmentDraft {
  assessment?: AssessmentDraft;
  /** Keyed by PHYSICIAN_EXAM_SECTIONS field keys (see physician-exam-sections.ts) — the "to be completed by the examining physician" page. */
  physicalExam?: Record<string, string>;
  labResults?: Record<string, string>;
  determination?: DeterminationDraft;
  attestation?: AttestationDraft;
}
