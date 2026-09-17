import { randomBytes } from 'node:crypto';
import { encryptJson } from '@ncb/shared';
import { describe, expect, it, vi } from 'vitest';
import type { PatientProfile, PrismaClient } from '../../../generated/client/index.js';
import { buildCandidateSearchWhere, createCandidatesRepository } from '../../candidates.js';

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

  it('findById() returns null when no candidate matches', async () => {
    const db = {
      patientProfile: { findFirst: vi.fn().mockResolvedValue(null) }
    } as unknown as PrismaClient;

    const found = await createCandidatesRepository(db).findById('missing', masterKey);

    expect(found).toBeNull();
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

  describe('buildCandidateSearchWhere()', () => {
    const CANCELLED = ['canceled_by_doctor', 'withdrawn'];

    it('always excludes soft-deleted candidates, even with no filters', () => {
      expect(buildCandidateSearchWhere({})).toEqual({ AND: [{ deletedAt: null }] });
    });

    it('matches the query against fullName, employeeId, or email', () => {
      expect(buildCandidateSearchWhere({ query: 'jane' })).toEqual({
        AND: [
          { deletedAt: null },
          {
            OR: [
              { fullName: { contains: 'jane', mode: 'insensitive' } },
              { employeeId: { contains: 'jane', mode: 'insensitive' } },
              { email: { contains: 'jane', mode: 'insensitive' } }
            ]
          }
        ]
      });
    });

    it('scopes to a status and a position independently', () => {
      const where = buildCandidateSearchWhere({ status: 'assigned', position: 'Teller' });
      expect(where.AND).toContainEqual({ status: 'assigned' });
      expect(where.AND).toContainEqual({ position: 'Teller' });
    });

    it('caseStage matches a candidate with at least one case in that status', () => {
      expect(buildCandidateSearchWhere({ caseStage: 'sent_to_doctor' })).toEqual({
        AND: [{ deletedAt: null }, { cases: { some: { status: 'sent_to_doctor' } } }]
      });
    });

    it('caseBilling "not_payable" matches a candidate with a cancelled or explicitly not_payable case', () => {
      expect(buildCandidateSearchWhere({ caseBilling: 'not_payable' })).toEqual({
        AND: [
          { deletedAt: null },
          { cases: { some: { OR: [{ status: { in: CANCELLED } }, { paymentStatus: 'not_payable' }] } } }
        ]
      });
    });

    it('caseBilling "paid" excludes cancelled cases and requires paymentStatus paid on the matching case', () => {
      expect(buildCandidateSearchWhere({ caseBilling: 'paid' })).toEqual({
        AND: [{ deletedAt: null }, { cases: { some: { status: { notIn: CANCELLED }, paymentStatus: 'paid' } } }]
      });
    });

    it('an unrecognized caseBilling value matches no candidate', () => {
      // @ts-expect-error deliberately invalid, to confirm the fallback for a garbage query param
      const where = buildCandidateSearchWhere({ caseBilling: 'garbage' });
      expect(where.AND).toContainEqual({ cases: { some: { id: '__no_case_matches_this_billing_value__' } } });
    });
  });

  describe('search()', () => {
    it('paginates via skip/take, includes a case count, and runs a matching count in parallel', async () => {
      const findMany = vi.fn().mockResolvedValue([{ id: 'cand_1', profilePayload: null, _count: { cases: 3 } }]);
      const count = vi.fn().mockResolvedValue(12);
      const db = { patientProfile: { findMany, count } } as unknown as PrismaClient;

      const result = await createCandidatesRepository(db).search({ status: 'assigned' }, 2, 8, masterKey);

      const expectedWhere = buildCandidateSearchWhere({ status: 'assigned' });
      expect(findMany).toHaveBeenCalledWith({
        where: expectedWhere,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: 8,
        take: 8,
        include: { _count: { select: { cases: true } } }
      });
      expect(count).toHaveBeenCalledWith({ where: expectedWhere });
      expect(result.total).toBe(12);
      expect(result.rows[0]).toEqual(expect.objectContaining({ id: 'cand_1', payload: null, caseCount: 3 }));
    });
  });

  describe('getStats()', () => {
    it('counts total/newThisMonth/portalAccessGranted/noMedicalsYet, scoped to a linkedUserId when given', async () => {
      const count = vi.fn().mockResolvedValueOnce(5).mockResolvedValueOnce(1).mockResolvedValueOnce(2).mockResolvedValueOnce(1);
      const db = { patientProfile: { count } } as unknown as PrismaClient;

      const result = await createCandidatesRepository(db).getStats('usr_patient_1');

      expect(count).toHaveBeenNthCalledWith(1, { where: { AND: [{ deletedAt: null }, { linkedUserId: 'usr_patient_1' }] } });
      expect(count.mock.calls[2]![0].where.AND).toContainEqual({ linkedUserId: { not: null } });
      expect(result).toEqual({ total: 5, newThisMonth: 1, portalAccessGranted: 2, noMedicalsYet: 1 });
    });
  });

  describe('listDistinctPositions()', () => {
    it('returns distinct, non-null positions sorted alphabetically', async () => {
      const findMany = vi.fn().mockResolvedValue([{ position: 'Teller' }, { position: null }, { position: 'Analyst' }]);
      const db = { patientProfile: { findMany } } as unknown as PrismaClient;

      const positions = await createCandidatesRepository(db).listDistinctPositions();

      expect(findMany).toHaveBeenCalledWith({
        where: { deletedAt: null, position: { not: null } },
        select: { position: true },
        distinct: ['position']
      });
      expect(positions).toEqual(['Analyst', 'Teller']);
    });
  });
});
