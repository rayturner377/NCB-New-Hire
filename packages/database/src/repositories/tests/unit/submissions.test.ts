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
});
