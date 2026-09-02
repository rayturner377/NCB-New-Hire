import { describe, expect, it } from 'vitest';
import { createSubmissionSchema } from '../../submission';

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    candidate: {
      fullName: 'Jane Doe',
      dateOfBirth: '1990-01-01',
      position: 'Teller'
    },
    assessment: {
      facilityName: 'City Medical Centre',
      assessmentDate: '2026-01-01',
      clinicianName: 'Dr. Example'
    },
    determination: { status: 'fit' },
    attestation: {
      signedBy: 'Dr. Example',
      signatureDate: '2026-01-01',
      consentConfirmed: true
    },
    ...overrides
  };
}

describe('createSubmissionSchema', () => {
  it('accepts a minimal valid submission', () => {
    const result = createSubmissionSchema.safeParse(validInput());
    expect(result.success).toBe(true);
  });

  it('defaults the loose clinical-detail records to empty objects', () => {
    const result = createSubmissionSchema.safeParse(validInput());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.vitals).toEqual({});
      expect(result.data.medicalHistory).toEqual({});
    }
  });

  it('rejects a missing candidate full name', () => {
    const input = validInput();
    (input.candidate as Record<string, unknown>).fullName = '';
    expect(createSubmissionSchema.safeParse(input).success).toBe(false);
  });

  it('rejects an unrecognized determination status', () => {
    const input = validInput({ determination: { status: 'perfectly-fine' } });
    expect(createSubmissionSchema.safeParse(input).success).toBe(false);
  });

  it('rejects submission without consent confirmation', () => {
    const input = validInput({
      attestation: { signedBy: 'Dr. Example', signatureDate: '2026-01-01', consentConfirmed: false }
    });
    expect(createSubmissionSchema.safeParse(input).success).toBe(false);
  });

  it('rejects an invalid assessment date', () => {
    const input = validInput();
    (input.assessment as Record<string, unknown>).assessmentDate = 'not-a-date';
    expect(createSubmissionSchema.safeParse(input).success).toBe(false);
  });
});
