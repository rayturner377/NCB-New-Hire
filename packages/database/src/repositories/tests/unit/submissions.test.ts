import { createHash, randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { MedicalSubmission, PrismaClient } from '../../../generated/client/index.js';
import { createSubmissionsRepository, decryptSubmission } from '../../submissions.js';

describe('submissions repository', () => {
  const masterKey = randomBytes(32);

  it('save() produces a payload_sha256 matching the stored ciphertext', async () => {
    let createdData: MedicalSubmission | undefined;

    const db = {
      medicalSubmission: {
        create: vi.fn().mockImplementation(({ data }: { data: MedicalSubmission }) => {
          createdData = data;
          return Promise.resolve(data);
        })
      }
    } as unknown as PrismaClient;

    const repository = createSubmissionsRepository(db);
    const payload = { candidate: { fullName: 'Jane Doe' }, determination: { status: 'fit' } };
    await repository.save({ id: 'sub_1', caseId: 'case_1', payload }, masterKey);

    expect(createdData).toBeDefined();
    expect(decryptSubmission(createdData!, masterKey)).toEqual(payload);

    const recomputedSha256 = createHash('sha256')
      .update(Buffer.from(createdData!.encryptedPayload))
      .digest('hex');
    expect(createdData!.payloadSha256).toBe(recomputedSha256);
  });

  it('verifyIntegrity() detects a tampered ciphertext', async () => {
    let stored: MedicalSubmission | undefined;

    const db = {
      medicalSubmission: {
        create: vi.fn().mockImplementation(({ data }: { data: MedicalSubmission }) => {
          stored = data;
          return Promise.resolve(data);
        }),
        findFirst: vi.fn().mockImplementation(() => Promise.resolve(stored))
      }
    } as unknown as PrismaClient;

    const repository = createSubmissionsRepository(db);
    await repository.save({ id: 'sub_1', caseId: 'case_1', payload: { a: 1 } }, masterKey);

    expect(await repository.verifyIntegrity('sub_1')).toBe(true);

    const tampered = Buffer.from(stored!.encryptedPayload as Buffer);
    tampered[0] = tampered[0] ^ 0xff;
    stored = { ...stored!, encryptedPayload: tampered };

    expect(await repository.verifyIntegrity('sub_1')).toBe(false);
  });

  it('verifyIntegrity() returns false for a missing submission', async () => {
    const db = {
      medicalSubmission: { findFirst: vi.fn().mockResolvedValue(null) }
    } as unknown as PrismaClient;

    const repository = createSubmissionsRepository(db);
    expect(await repository.verifyIntegrity('does-not-exist')).toBe(false);
  });

  it('listAll() returns every submission row', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const db = { medicalSubmission: { findMany } } as unknown as PrismaClient;

    await createSubmissionsRepository(db).listAll();

    expect(findMany).toHaveBeenCalledWith();
  });

  it('findById() looks up a single submission', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'sub_1' });
    const db = { medicalSubmission: { findFirst } } as unknown as PrismaClient;

    const found = await createSubmissionsRepository(db).findById('sub_1');

    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'sub_1' } });
    expect(found).toEqual({ id: 'sub_1' });
  });

  it('listForCase() orders submissions by version descending, then by submitted-at as a tiebreaker', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const db = { medicalSubmission: { findMany } } as unknown as PrismaClient;

    await createSubmissionsRepository(db).listForCase('case_1');

    expect(findMany).toHaveBeenCalledWith({
      where: { caseId: 'case_1' },
      orderBy: [{ submissionVersion: 'desc' }, { submittedAt: 'desc' }]
    });
  });

  describe('saveAndTransition()', () => {
    /** A minimal fake PrismaClient whose $transaction just invokes the callback with itself as `tx` — enough to unit-test the orchestration without a real Postgres connection. */
    function fakeDb(overrides: {
      existingSubmissions?: { submissionVersion: number }[];
      caseStatus?: string | null;
      transitionRows?: { transition_medical_case: number }[];
    } = {}) {
      const created: { data?: unknown } = {};
      const updated: { data?: unknown }[] = [];
      const db = {
        medicalSubmission: {
          findMany: vi.fn().mockResolvedValue(overrides.existingSubmissions ?? []),
          create: vi.fn().mockImplementation(({ data }) => {
            created.data = data;
            return Promise.resolve(data);
          })
        },
        medicalCase: {
          update: vi.fn().mockImplementation(({ data }) => {
            updated.push({ data });
            return Promise.resolve(data);
          }),
          findFirst: vi.fn().mockResolvedValue(overrides.caseStatus === undefined ? { status: 'sent_to_doctor' } : overrides.caseStatus ? { status: overrides.caseStatus } : null)
        },
        $queryRaw: vi.fn().mockResolvedValue(overrides.transitionRows ?? [{ transition_medical_case: 3 }])
      };
      (db as unknown as { $transaction: unknown }).$transaction = (callback: (tx: unknown) => unknown) => callback(db);
      return { db: db as unknown as PrismaClient, created, updated };
    }

    it('computes the next submission version from the existing rows and passes it to buildPayload', async () => {
      const { db } = fakeDb({ existingSubmissions: [{ submissionVersion: 1 }] });
      const buildPayload = vi.fn().mockReturnValue({ a: 1 });

      await createSubmissionsRepository(db).saveAndTransition(
        { id: 'sub_2', caseId: 'case_1', expectedVersion: 2, newStatus: 'doctor_submitted', actorId: 'usr_1' },
        randomBytes(32),
        buildPayload
      );

      expect(buildPayload).toHaveBeenCalledWith(2);
    });

    it('defaults to submission version 1 when the case has no prior submissions', async () => {
      const { db } = fakeDb({ existingSubmissions: [] });
      const buildPayload = vi.fn().mockReturnValue({});

      await createSubmissionsRepository(db).saveAndTransition(
        { id: 'sub_1', caseId: 'case_1', expectedVersion: 1, newStatus: 'doctor_submitted', actorId: 'usr_1' },
        randomBytes(32),
        buildPayload
      );

      expect(buildPayload).toHaveBeenCalledWith(1);
    });

    it('updates billing only when given a billing input', async () => {
      const { db, updated } = fakeDb();

      await createSubmissionsRepository(db).saveAndTransition(
        {
          id: 'sub_1',
          caseId: 'case_1',
          expectedVersion: 2,
          newStatus: 'doctor_submitted',
          actorId: 'usr_1',
          billing: { payableAmount: 150, paymentStatus: 'unpaid' }
        },
        randomBytes(32),
        () => ({})
      );

      expect(updated).toHaveLength(1);
      expect(updated[0]!.data).toEqual({ payableAmount: 150, paymentStatus: 'unpaid' });
    });

    it('skips the billing update when none is given', async () => {
      const { db, updated } = fakeDb();

      await createSubmissionsRepository(db).saveAndTransition(
        { id: 'sub_1', caseId: 'case_1', expectedVersion: 2, newStatus: 'doctor_submitted', actorId: 'usr_1' },
        randomBytes(32),
        () => ({})
      );

      expect(updated).toHaveLength(0);
    });

    it('returns the new case version and the status the case had before the transition', async () => {
      const { db } = fakeDb({ caseStatus: 'sent_to_doctor', transitionRows: [{ transition_medical_case: 5 }] });

      const result = await createSubmissionsRepository(db).saveAndTransition(
        { id: 'sub_1', caseId: 'case_1', expectedVersion: 4, newStatus: 'doctor_submitted', actorId: 'usr_1' },
        randomBytes(32),
        () => ({})
      );

      expect(result.newCaseVersion).toBe(5);
      expect(result.previousStatus).toBe('sent_to_doctor');
    });

    it('throws (rolling back the transaction) when the stored procedure reports no matching row — a stale/replayed expectedVersion', async () => {
      const { db } = fakeDb({ transitionRows: [] });

      await expect(
        createSubmissionsRepository(db).saveAndTransition(
          { id: 'sub_1', caseId: 'case_1', expectedVersion: 99, newStatus: 'doctor_submitted', actorId: 'usr_1' },
          randomBytes(32),
          () => ({})
        )
      ).rejects.toThrow('Medical case changed or does not exist');
    });
  });
});
