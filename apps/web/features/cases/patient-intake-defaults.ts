import { splitFullName } from '../../lib/full-name';
import type { CandidatePayload } from '../candidates/types';
import { emptyPatientCaseData, type PatientCaseData } from './patient-case-data';

/**
 * Seeds (or backfills) the patient intake form from whatever HR already collected on the candidate
 * profile — address, phone numbers, primary physician, and emergency contact all map straight
 * across since both forms use the exact same fields (AddressFields/PhoneNumbersField/ContactFields)
 * for them; see patient-case-data.ts's top comment.
 *
 * Runs even when `existingData` is already present (an in-progress case, not a brand-new one) —
 * dateOfBirth/nationalId specifically get backfilled from the candidate profile whenever the form's
 * own value is still blank, so a draft saved before those fields existed on this form (or one the
 * patient just hasn't touched yet) shows HR's own value instead of a blank the patient has to go dig
 * up and retype themselves.
 */
export function buildPatientIntakeDefaults(
  candidate: Pick<
    CandidatePayload,
    | 'fullName'
    | 'dateOfBirth'
    | 'nationalId'
    | 'addressLine1'
    | 'addressLine2'
    | 'city'
    | 'state'
    | 'country'
    | 'contactNumber'
    | 'primaryPhysicianName'
    | 'primaryPhysicianNumber'
    | 'emergencyContactName'
    | 'emergencyContactNumber'
  >,
  existingData: PatientCaseData | undefined
): PatientCaseData {
  const { firstName, lastName } = splitFullName(candidate.fullName);
  const baseData =
    existingData ??
    emptyPatientCaseData({
      firstName,
      lastName,
      dateOfBirth: candidate.dateOfBirth,
      nationalId: candidate.nationalId,
      addressLine1: candidate.addressLine1,
      addressLine2: candidate.addressLine2,
      city: candidate.city,
      state: candidate.state,
      country: candidate.country,
      // The candidate profile's contactNumber has no per-entry type (just a comma-joined list) —
      // "Mobile" is a reasonable default label for each one, since the patient can relabel/edit
      // them here regardless.
      phones: candidate.contactNumber
        ? candidate.contactNumber
            .split(', ')
            .filter(Boolean)
            .map((number) => ({ type: 'Mobile', number }))
        : [],
      primaryPhysicianName: candidate.primaryPhysicianName,
      primaryPhysicianNumber: candidate.primaryPhysicianNumber,
      emergencyContactName: candidate.emergencyContactName,
      emergencyContactNumber: candidate.emergencyContactNumber
    });

  return {
    ...baseData,
    personalInfo: {
      ...baseData.personalInfo,
      dateOfBirth: baseData.personalInfo.dateOfBirth || candidate.dateOfBirth,
      nationalId: baseData.personalInfo.nationalId || candidate.nationalId
    }
  };
}
