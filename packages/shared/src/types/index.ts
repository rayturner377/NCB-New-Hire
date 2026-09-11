/**
 * Domain types shared across repositories/server/web. These are a starting point
 * derived from the current server.js object shapes (sanitizeCandidate ~L3011,
 * toSubmissionSummary ~L3402, sanitizeSettings ~L4319, publicUser ~L4826,
 * sanitizeMedicalProfile ~L5049) — expect them to be refined/tightened once the
 * Prisma schema (Branch 2) is the source of truth for column-level shape.
 */

export type UserRole = 'clinician' | 'reviewer' | 'admin';

export interface MedicalProfile {
  facilityName: string;
  facilityAddress: string;
  clinicianName: string;
  officeUserType: string;
  registrationNumber: string;
  defaultMedicalFee: number;
  signatureDataUrl: string;
}

export interface AppUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  active: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  medicalProfile: MedicalProfile;
}

export type CandidateStatus = 'assigned' | 'submitted' | 'withdrawn' | string;

export interface Candidate {
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
}

export interface SubmissionSummary {
  id: string;
  caseId: string;
  patientId: string;
  submittedAt: string;
  submittedByName: string;
  candidateName: string;
  employeeId: string;
  position: string;
  facilityName: string;
  clinicianName: string;
  determinationStatus: string;
  reviewStatus: string;
}

export interface AppSettings {
  organizationName: string;
  appName: string;
  clinicianIntro: string;
  reviewerIntro: string;
  confidentialityNotice: string;
  notificationEmail: string;
  doctorNotificationEmail: string;
  supportContact: string;
  primaryColor: string;
  accentColor: string;
}

export interface AuditEntry {
  ts: string;
  event: string;
  [key: string]: unknown;
}
