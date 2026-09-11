import { randomBytes } from 'node:crypto';
import { encryptJson } from '@ncb/shared';
import { describe, expect, it, vi } from 'vitest';
import type { PatientProfile, PrismaClient } from '../../../generated/client/index.js';
import { createCandidatesRepository } from '../../candidates.js';

describe('candidates repository', () => {
  const masterKey = randomBytes(32);

  it('save() then findById() round-trips the encrypted candidate payload', async () => {
    let stored: PatientProfile | undefined;

    const db = {
      patientProfile: {
        upsert: vi.fn().mockImplementation(({ create }: { create: PatientProfile }) => {
          stored = create;
          return Promise.resolve(create);
        }),
        findFirst: vi.fn().mockImplementation(() => Promise.resolve(stored ?? null))
      }
    } as unknown as PrismaClient;

    const repository = createCandidatesRepository(db);
    const payload = { fullName: 'Jane Doe', employeeId: 'EMP-1' };

    await repository.save({ id: 'cand_1', fullName: 'Jane Doe', payload }, masterKey);
    const found = await repository.findById('cand_1', masterKey);

    expect(found?.payload).toEqual(payload);
  });

  it('returns payload: null when profile_payload is absent', async () => {
    const db = {
      patientProfile: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'cand_2',
          fullName: 'No Payload',
          profilePayload: null
        })
      }
    } as unknown as PrismaClient;

    const repository = createCandidatesRepository(db);
    const found = await repository.findById('cand_2', masterKey);

    expect(found?.payload).toBeNull();
  });

  it('listAll() decrypts every non-deleted candidate', async () => {
    const record = JSON.stringify(encryptJson(masterKey, { fullName: 'A' }));
    const db = {
      patientProfile: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'cand_1', profilePayload: Buffer.from(record, 'utf8') },
          { id: 'cand_2', profilePayload: null }
        ])
      }
    } as unknown as PrismaClient;

    const repository = createCandidatesRepository(db);
    const all = await repository.listAll(masterKey);

    expect(db.patientProfile.findMany).toHaveBeenCalledWith({ where: { deletedAt: null } });
    expect(all).toHaveLength(2);
    expect(all[0].payload).toEqual({ fullName: 'A' });
    expect(all[1].payload).toBeNull();
  });

  it('listForUser() scopes candidates to the linked user id', async () => {
    const db = {
      patientProfile: {
        findMany: vi.fn().mockResolvedValue([])
      }
    } as unknown as PrismaClient;

    const repository = createCandidatesRepository(db);
    await repository.listForUser('user_1', masterKey);

    expect(db.patientProfile.findMany).toHaveBeenCalledWith({
      where: { linkedUserId: 'user_1', deletedAt: null }
    });
  });
});
