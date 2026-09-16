import { randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { MedicalCase, PrismaClient } from '../../../generated/client/index.js';
import { CaseVersionConflictError, createCasesRepository } from '../../cases.js';

describe('cases repository', () => {
  const masterKey = randomBytes(32);

  it('transition() returns the new version on success', async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ transition_medical_case: 2 }]);
    const db = { $queryRaw: queryRaw } as unknown as PrismaClient;

    const repository = createCasesRepository(db);
    const newVersion = await repository.transition('case_1', 1, 'reviewed', 'user_1');

    expect(newVersion).toBe(2);
    expect(queryRaw).toHaveBeenCalled();
  });

  it('transition() throws when the stored procedure returns no row', async () => {
    const db = { $queryRaw: vi.fn().mockResolvedValue([]) } as unknown as PrismaClient;

    const repository = createCasesRepository(db);
    await expect(repository.transition('case_1', 1, 'reviewed', 'user_1')).rejects.toThrow(
      'Medical case changed or does not exist'
    );
  });

  it('listAll() excludes soft-deleted cases and decrypts each payload', async () => {
    const db = {
      medicalCase: { findMany: vi.fn().mockResolvedValue([{ id: 'case_1', casePayload: null }]) }
    } as unknown as PrismaClient;

    const rows = await createCasesRepository(db).listAll(masterKey);

    expect(db.medicalCase.findMany).toHaveBeenCalledWith({ where: { deletedAt: null } });
    expect(rows).toEqual([{ id: 'case_1', casePayload: null, payload: null }]);
  });

  it('findById() looks up a single non-deleted case', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'case_1', casePayload: null });
    const db = { medicalCase: { findFirst } } as unknown as PrismaClient;

    const found = await createCasesRepository(db).findById('case_1', masterKey);

    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'case_1', deletedAt: null } });
    expect(found?.payload).toBeNull();
  });

  it('findById() returns null when no case matches', async () => {
    const db = { medicalCase: { findFirst: vi.fn().mockResolvedValue(null) } } as unknown as PrismaClient;
    expect(await createCasesRepository(db).findById('missing', masterKey)).toBeNull();
  });

  it('create() then findById() round-trips the encrypted case payload', async () => {
    let stored: MedicalCase | undefined;

    const db = {
      medicalCase: {
        create: vi.fn().mockImplementation(({ data }: { data: MedicalCase }) => {
          stored = data;
          return Promise.resolve(data);
        }),
        findFirst: vi.fn().mockImplementation(() => Promise.resolve(stored ?? null))
      }
    } as unknown as PrismaClient;

    const repository = createCasesRepository(db);
    await repository.create(
      { id: 'case_1', patientId: 'cand_1', route: 'doctor', status: 'sent_to_doctor', payload: { notes: 'x' } },
      masterKey
    );

    expect(db.medicalCase.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ id: 'case_1', patientId: 'cand_1', version: 1, payloadKeyVersion: 1 })
    });

    const found = await repository.findById('case_1', masterKey);
    expect(found?.payload).toEqual({ notes: 'x' });
  });

  it('setBilling() writes payableAmount/paymentStatus directly, independent of any encrypted payload', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'case_1', payableAmount: 150, paymentStatus: 'unpaid' });
    const db = { medicalCase: { update } } as unknown as PrismaClient;

    await createCasesRepository(db).setBilling('case_1', 150, 'unpaid');

    expect(update).toHaveBeenCalledWith({ where: { id: 'case_1' }, data: { payableAmount: 150, paymentStatus: 'unpaid' } });
  });

  const patientSelect = { select: { id: true, fullName: true, employeeId: true } };
  const rowWithPatient = { id: 'case_1', casePayload: null, patient: { id: 'cand_1', fullName: 'Jane Doe', employeeId: 'EMP-1' } };

  it('listAllWithPatient() joins the patient and excludes soft-deleted cases', async () => {
    const findMany = vi.fn().mockResolvedValue([rowWithPatient]);
    const db = { medicalCase: { findMany } } as unknown as PrismaClient;

    const rows = await createCasesRepository(db).listAllWithPatient(masterKey);

    expect(findMany).toHaveBeenCalledWith({
      where: { deletedAt: null },
      include: { patient: patientSelect },
      orderBy: { updatedAt: 'desc' }
    });
    expect(rows[0]!.patient).toEqual(rowWithPatient.patient);
    expect(rows[0]!.payload).toBeNull();
  });

  it('findByIdWithPatient() joins the patient for a single case', async () => {
    const findFirst = vi.fn().mockResolvedValue(rowWithPatient);
    const db = { medicalCase: { findFirst } } as unknown as PrismaClient;

    const found = await createCasesRepository(db).findByIdWithPatient('case_1', masterKey);

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'case_1', deletedAt: null },
      include: { patient: patientSelect }
    });
    expect(found?.patient).toEqual(rowWithPatient.patient);
  });

  it('findByIdWithPatient() returns null when no case matches', async () => {
    const db = { medicalCase: { findFirst: vi.fn().mockResolvedValue(null) } } as unknown as PrismaClient;
    expect(await createCasesRepository(db).findByIdWithPatient('missing', masterKey)).toBeNull();
  });

  it('listForClinician() scopes to the assigned clinician', async () => {
    const findMany = vi.fn().mockResolvedValue([rowWithPatient]);
    const db = { medicalCase: { findMany } } as unknown as PrismaClient;

    await createCasesRepository(db).listForClinician('clinician_1', masterKey);

    expect(findMany).toHaveBeenCalledWith({
      where: { assignedClinicianId: 'clinician_1', deletedAt: null },
      include: { patient: patientSelect },
      orderBy: { updatedAt: 'desc' }
    });
  });

  it('listForPatient() scopes to the patient profile id', async () => {
    const findMany = vi.fn().mockResolvedValue([rowWithPatient]);
    const db = { medicalCase: { findMany } } as unknown as PrismaClient;

    await createCasesRepository(db).listForPatient('cand_1', masterKey);

    expect(findMany).toHaveBeenCalledWith({
      where: { patientId: 'cand_1', deletedAt: null },
      include: { patient: patientSelect },
      orderBy: { updatedAt: 'desc' }
    });
  });

  it('setAssignedClinician() stamps assignedAt alongside the clinician id', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'case_1' });
    const db = { medicalCase: { update } } as unknown as PrismaClient;

    await createCasesRepository(db).setAssignedClinician('case_1', 'clinician_1');

    expect(update).toHaveBeenCalledWith({
      where: { id: 'case_1' },
      data: { assignedClinicianId: 'clinician_1', assignedAt: expect.any(Date) }
    });
  });

  it('confirmPayment() sets paymentStatus and paymentConfirmedAt in one statement', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'case_1' });
    const db = { medicalCase: { update } } as unknown as PrismaClient;
    const confirmedAt = new Date('2026-01-01T00:00:00.000Z');

    await createCasesRepository(db).confirmPayment('case_1', confirmedAt);

    expect(update).toHaveBeenCalledWith({
      where: { id: 'case_1' },
      data: { paymentStatus: 'paid', paymentConfirmedAt: confirmedAt }
    });
  });

  it('updatePayload() re-encrypts and overwrites only the payload column when no expectedVersion is given', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'case_1' });
    const db = { medicalCase: { update } } as unknown as PrismaClient;

    await createCasesRepository(db).updatePayload('case_1', { notes: 'updated' }, masterKey);

    expect(update).toHaveBeenCalledWith({ where: { id: 'case_1' }, data: { casePayload: expect.any(Buffer) } });
  });

  it('updatePayload() with an expectedVersion does a conditional update and re-fetches the row on success', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const findFirstOrThrow = vi.fn().mockResolvedValue({ id: 'case_1', version: 3 });
    const db = { medicalCase: { updateMany, findFirstOrThrow } } as unknown as PrismaClient;

    const result = await createCasesRepository(db).updatePayload('case_1', { notes: 'updated' }, masterKey, undefined, 3);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'case_1', version: 3 },
      data: { casePayload: expect.any(Buffer) }
    });
    // The row itself is never version-bumped by a plain payload save — see updatePayload's own doc
    // comment on why (a draft save isn't a workflow transition, and bumping it here would make an
    // editor's own next autosave immediately conflict with itself).
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.not.objectContaining({ version: expect.anything() }) }));
    expect(result).toEqual({ id: 'case_1', version: 3 });
  });

  it('updatePayload() throws CaseVersionConflictError when the version no longer matches', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const db = { medicalCase: { updateMany } } as unknown as PrismaClient;

    await expect(createCasesRepository(db).updatePayload('case_1', { notes: 'updated' }, masterKey, undefined, 3)).rejects.toThrow(
      CaseVersionConflictError
    );
  });

  describe('submitAndTransition()', () => {
    /** A minimal fake PrismaClient whose $transaction just invokes the callback with itself as `tx` — same pattern as submissions.test.ts's fakeDb. */
    function fakeDb(overrides: { caseStatus?: string | null; transitionRows?: { transition_medical_case: number }[] } = {}) {
      const updates: { data: unknown }[] = [];
      const db = {
        medicalCase: {
          update: vi.fn().mockImplementation(({ data }) => {
            updates.push({ data });
            return Promise.resolve(data);
          }),
          findFirst: vi.fn().mockResolvedValue(overrides.caseStatus === undefined ? { status: 'sent_to_patient' } : overrides.caseStatus ? { status: overrides.caseStatus } : null)
        },
        $queryRaw: vi.fn().mockResolvedValue(overrides.transitionRows ?? [{ transition_medical_case: 2 }])
      };
      (db as unknown as { $transaction: unknown }).$transaction = (callback: (tx: unknown) => unknown) => callback(db);
      return { db: db as unknown as PrismaClient, updates };
    }

    it('writes the encrypted payload and the assigned clinician before transitioning', async () => {
      const { db, updates } = fakeDb();

      await createCasesRepository(db).submitAndTransition(
        {
          caseId: 'case_1',
          payload: { notes: 'submitted' },
          assignedClinicianId: 'usr_doctor_demo',
          expectedVersion: 1,
          newStatus: 'sent_to_doctor',
          actorId: 'usr_patient_demo'
        },
        masterKey
      );

      expect(updates).toHaveLength(2);
      expect(updates[0]!.data).toEqual({ casePayload: expect.any(Buffer) });
      expect(updates[1]!.data).toEqual({ assignedClinicianId: 'usr_doctor_demo', assignedAt: expect.any(Date) });
    });

    it('returns the new case version and the status the case had before the transition', async () => {
      const { db } = fakeDb({ caseStatus: 'sent_to_patient', transitionRows: [{ transition_medical_case: 2 }] });

      const result = await createCasesRepository(db).submitAndTransition(
        {
          caseId: 'case_1',
          payload: {},
          assignedClinicianId: 'usr_doctor_demo',
          expectedVersion: 1,
          newStatus: 'sent_to_doctor',
          actorId: 'usr_patient_demo'
        },
        masterKey
      );

      expect(result).toEqual({ newVersion: 2, previousStatus: 'sent_to_patient' });
    });

    it('throws (rolling back the payload/clinician writes) when the stored procedure reports no matching row', async () => {
      const { db } = fakeDb({ transitionRows: [] });

      await expect(
        createCasesRepository(db).submitAndTransition(
          {
            caseId: 'case_1',
            payload: {},
            assignedClinicianId: 'usr_doctor_demo',
            expectedVersion: 99,
            newStatus: 'sent_to_doctor',
            actorId: 'usr_patient_demo'
          },
          masterKey
        )
      ).rejects.toThrow('Medical case changed or does not exist');
    });
  });
});
