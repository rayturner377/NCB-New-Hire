/** Ported from server.js sanitizeSubmission (~L1385-1511). */
export type DeterminationStatus = 'fit' | 'fit_with_restrictions' | 'temporarily_deferred' | 'not_fit';
export type SubmissionReviewStatus = 'pending' | 'reviewed' | 'needs_follow_up' | 'archived';

export interface SubmissionCandidateSummary {
  candidateId: string;
  caseId: string;
  patientId: string;
  fullName: string;
  employeeId: string;
  nationalId: string;
  dateOfBirth: string;
  email: string;
  contactNumber: string;
  position: string;
  medicationInformation: string;
}

export interface SubmissionAssessment {
  facilityName: string;
  facilityAddress: string;
  assessmentDate: string;
  clinicianName: string;
  clinicianRegistrationNumber: string;
  telephoneNumber: string;
  faxNumber: string;
  emailAddress: string;
}

export interface SubmissionDetermination {
  status: DeterminationStatus;
  conclusions: string;
  restrictions: string;
  recommendation: string;
  followUpDate: string;
}

export interface SubmissionAttestation {
  signedBy: string;
  signatureDate: string;
  consentConfirmed: boolean;
  signatureDataUrl: string;
}

export interface SubmissionConsent {
  accepted: boolean;
  signedBy: string;
  signedAt: string;
  signatureDataUrl: string;
}

export interface SubmissionReview {
  status: SubmissionReviewStatus;
  notes: string;
  reviewedAt: string;
  reviewedBy: string;
  reviewedByName: string;
}

/**
 * vitals/medicalHistory/familyHistory/physicalExam/labResults are kept as
 * loose string-keyed records rather than exhaustively typed — these are plain
 * clinical text/boolean fields (server.js ~L1436-1476, sanitizePhysicianExam
 * ~L1513-1525) with no business logic branching on individual keys; the real
 * validation gate is the required fields below plus attestation.consentConfirmed.
 */
export interface SubmissionPayload {
  id: string;
  version: number;
  status: string;
  submittedAt: string;
  submittedBy: string;
  submittedByName: string;
  submittedByEmail: string;
  caseId: string;
  patientId: string;
  candidate: SubmissionCandidateSummary;
  assessment: SubmissionAssessment;
  vitals: Record<string, string | boolean>;
  medicalHistory: Record<string, boolean | string>;
  familyHistory: Record<string, boolean | string>;
  physicalExam: Record<string, string | boolean>;
  labResults: Record<string, string | boolean>;
  determination: SubmissionDetermination;
  customFields: Record<string, unknown>;
  attestation: SubmissionAttestation;
  consent: SubmissionConsent;
  review: SubmissionReview;
}
