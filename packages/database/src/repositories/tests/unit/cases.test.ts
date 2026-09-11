import { randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { MedicalCase, PrismaClient } from '../../../generated/client/index.js';
import { createCasesRepository } from '../../cases.js';

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

  it('setPaymentStatus() leaves payableAmount untouched', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'case_1', paymentStatus: 'paid' });
    const db = { medicalCase: { update } } as unknown as PrismaClient;

    await createCasesRepository(db).setPaymentStatus('case_1', 'paid');

    expect(update).toHaveBeenCalledWith({ where: { id: 'case_1' }, data: { paymentStatus: 'paid' } });
  });

  it('setPaymentConfirmedAt() records the real payment instant', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'case_1' });
    const db = { medicalCase: { update } } as unknown as PrismaClient;
    const confirmedAt = new Date('2026-01-01T00:00:00.000Z');

    await createCasesRepository(db).setPaymentConfirmedAt('case_1', confirmedAt);

    expect(update).toHaveBeenCalledWith({ where: { id: 'case_1' }, data: { paymentConfirmedAt: confirmedAt } });
  });

  it('updatePayload() re-encrypts and overwrites only the payload column', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'case_1' });
    const db = { medicalCase: { update } } as unknown as PrismaClient;

    await createCasesRepository(db).updatePayload('case_1', { notes: 'updated' }, masterKey);

    expect(update).toHaveBeenCalledWith({ where: { id: 'case_1' }, data: { casePayload: expect.any(Buffer) } });
  });
});
