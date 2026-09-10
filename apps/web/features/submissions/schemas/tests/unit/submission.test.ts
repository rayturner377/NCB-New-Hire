import { describe, expect, it } from 'vitest';
import { createSubmissionSchema } from '../../submission';

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const PNG_SIGNATURE_DATA_URL = `data:image/png;base64,${PNG_BYTES.toString('base64')}`;

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

  it('accepts a real PNG signature image', () => {
    const input = validInput({
      attestation: { signedBy: 'Dr. Example', signatureDate: '2026-01-01', consentConfirmed: true, signatureDataUrl: PNG_SIGNATURE_DATA_URL }
    });
    expect(createSubmissionSchema.safeParse(input).success).toBe(true);
  });

  it('rejects a signature field that is not real image content', () => {
    const input = validInput({
      attestation: {
        signedBy: 'Dr. Example',
        signatureDate: '2026-01-01',
        consentConfirmed: true,
        signatureDataUrl: `data:image/png;base64,${Buffer.from('not a real signature').toString('base64')}`
      }
    });
    expect(createSubmissionSchema.safeParse(input).success).toBe(false);
  });
});
