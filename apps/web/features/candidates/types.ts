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
  /** Split into the same 5 parts AddressFields collects (line1/line2/city/state/country), not a single combined string — a candidate's real address on file is what a medical case's intake form pre-fills from (see case-detail-container.tsx), which needs the parts separately. Use lib/address.ts's formatAddress() for a single-line display. */
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  emergencyContactName: string;
  emergencyContactNumber: string;
  primaryPhysicianName: string;
  primaryPhysicianNumber: string;
  position: string;
  medicationInformation: string;
  /** Set once portal access has been granted — see features/users' createUser and old server.js's linkedUserId (~L693-694). */
  linkedUserId: string;
}
