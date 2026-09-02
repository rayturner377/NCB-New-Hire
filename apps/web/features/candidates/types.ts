/** Ported from server.js sanitizeCandidate (~L3011-3039) — the full object stored, encrypted, in profile_payload. */
export type CandidateStatus = 'assigned' | 'submitted' | 'withdrawn' | 'archived';

export interface CandidatePayload {
  id: string;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  assignedAt: string;
  assignedClinicianId: string;
  assignedClinicianName: string;
  status: CandidateStatus;
  withdrawalReason: string;
  submittedAt: string;
  submissionId: string;
  fullName: string;
  employeeId: string;
  nationalId: string;
  dateOfBirth: string;
  email: string;
  contactNumber: string;
  address: string;
  emergencyContactName: string;
  emergencyContactNumber: string;
  primaryPhysician: string;
  position: string;
  medicationInformation: string;
}
