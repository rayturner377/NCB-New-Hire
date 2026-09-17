import { describe, expect, it } from 'vitest';
import { buildPatientIntakeDefaults } from '../../patient-intake-defaults';
import { emptyPatientCaseData } from '../../patient-case-data';

const candidate = {
  fullName: 'Jane Doe',
  dateOfBirth: '1990-01-01',
  nationalId: 'NID123',
  addressLine1: '1 Main St',
  addressLine2: '',
  city: 'Kingston',
  state: 'St. Andrew',
  country: 'Jamaica',
  contactNumber: '876-555-0100, 876-555-0101',
  primaryPhysicianName: 'Dr. Smith',
  primaryPhysicianNumber: '876-555-0199',
  emergencyContactName: 'John Doe',
  emergencyContactNumber: '876-555-0198'
};

describe('buildPatientIntakeDefaults', () => {
  it('seeds a brand-new form entirely from the candidate profile, splitting comma-joined phone numbers into Mobile entries', () => {
    const data = buildPatientIntakeDefaults(candidate, undefined);

    expect(data.personalInfo.firstName).toBe('Jane');
    expect(data.personalInfo.lastName).toBe('Doe');
    expect(data.personalInfo.dateOfBirth).toBe('1990-01-01');
    expect(data.personalInfo.nationalId).toBe('NID123');
    expect(data.personalInfo.phones).toEqual([
      { type: 'Mobile', number: '876-555-0100' },
      { type: 'Mobile', number: '876-555-0101' }
    ]);
    expect(data.primaryPhysicianName).toBe('Dr. Smith');
    expect(data.emergencyContactName).toBe('John Doe');
  });

  it('leaves no phone entries when the candidate has no contact number on file', () => {
    const data = buildPatientIntakeDefaults({ ...candidate, contactNumber: '' }, undefined);

    expect(data.personalInfo.phones).toEqual([]);
  });

  it('keeps an in-progress form as-is, only backfilling dateOfBirth/nationalId when the form left them blank', () => {
    const existing = emptyPatientCaseData({ firstName: 'Already', lastName: 'Typed', addressLine1: 'Custom address' });
    existing.personalInfo.dateOfBirth = '';
    existing.personalInfo.nationalId = '';

    const data = buildPatientIntakeDefaults(candidate, existing);

    expect(data.personalInfo.firstName).toBe('Already');
    expect(data.personalInfo.addressLine1).toBe('Custom address');
    expect(data.personalInfo.dateOfBirth).toBe('1990-01-01');
    expect(data.personalInfo.nationalId).toBe('NID123');
  });

  it("does not overwrite dateOfBirth/nationalId the patient already filled in themselves", () => {
    const existing = emptyPatientCaseData();
    existing.personalInfo.dateOfBirth = '1985-05-05';
    existing.personalInfo.nationalId = 'PATIENT-OWN-ID';

    const data = buildPatientIntakeDefaults(candidate, existing);

    expect(data.personalInfo.dateOfBirth).toBe('1985-05-05');
    expect(data.personalInfo.nationalId).toBe('PATIENT-OWN-ID');
  });
});
