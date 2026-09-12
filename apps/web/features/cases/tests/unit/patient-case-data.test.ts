import { describe, expect, it } from 'vitest';
import { emptyPatientCaseData } from '../../patient-case-data';

describe('emptyPatientCaseData', () => {
  it('defaults every field to blank/Jamaica when called with nothing', () => {
    const data = emptyPatientCaseData();

    expect(data.personalInfo.country).toBe('Jamaica');
    expect(data.primaryPhysicianName).toBe('');
    expect(data.emergencyContactNumber).toBe('');
    expect(data.familyHistory.relatives).toHaveLength(2);
  });

  it('seeds personal info and contact defaults from an existing candidate profile', () => {
    const data = emptyPatientCaseData({
      firstName: 'Jane',
      country: 'Canada',
      primaryPhysicianName: 'Dr. Smith',
      primaryPhysicianNumber: '+18760000000',
      emergencyContactName: 'John Doe',
      emergencyContactNumber: '+18761111111'
    });

    expect(data.personalInfo.firstName).toBe('Jane');
    expect(data.personalInfo.country).toBe('Canada');
    expect(data.primaryPhysicianName).toBe('Dr. Smith');
    expect(data.emergencyContactName).toBe('John Doe');
  });
});
