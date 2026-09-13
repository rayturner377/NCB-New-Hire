import { decryptJson, encryptJson, type EncryptedRecord } from '@ncb/shared';
import type { MedicalCase, PrismaClient } from '../generated/client/index.js';
import { prisma } from '../client.js';

export interface NewCaseInput {
  id: string;
  patientId: string;
  createdBy?: string;
  assignedOfficeId?: string;
  assignedClinicianId?: string;
  route: string;
  status: string;
  /** Supplementary details with no dedicated column; encrypted into case_payload. */
  payload?: unknown;
}

export interface CaseWithPayload<T = unknown> extends MedicalCase {
  payload: T | null;
}

export interface CaseWithPatient<T = unknown> extends CaseWithPayload<T> {
  patient: { id: string; fullName: string; employeeId: string | null };
}

function decryptCase<T = unknown>(row: MedicalCase, masterKey: Buffer): CaseWithPayload<T> {
  if (!row.casePayload) return { ...row, payload: null };
  const record = JSON.parse(Buffer.from(row.casePayload).toString('utf8')) as EncryptedRecord;
  return { ...row, payload: decryptJson<T>(masterKey, record) };
}

/**
 * Status transitions go through the transition_medical_case(...) stored
 * procedure (see prisma/migrations/0001_init/migration.sql) rather than a
 * hand-rolled compare-and-swap in JS, so optimistic concurrency (the `version`
 * column) is enforced by Postgres itself. On a stale `expectedVersion` the
 * procedure raises `Medical case changed or does not exist`, which surfaces as
 * a thrown error here — callers (apps/server) should catch it and return a
 * 409 Conflict rather than silently overwriting.
 */
export function createCasesRepository(db: PrismaClient) {
  return {
    async listAll<T = unknown>(masterKey: Buffer): Promise<CaseWithPayload<T>[]> {
      const rows = await db.medicalCase.findMany({ where: { deletedAt: null } });
      return rows.map((row) => decryptCase<T>(row, masterKey));
    },

    async findById<T = unknown>(id: string, masterKey: Buffer): Promise<CaseWithPayload<T> | null> {
      const row = await db.medicalCase.findFirst({ where: { id, deletedAt: null } });
      return row ? decryptCase<T>(row, masterKey) : null;
    },

    /** All cases (reviewer/admin's full list), with the patient's non-encrypted name/employeeId joined in — same reasoning as listForClinician. */
    async listAllWithPatient<T = unknown>(masterKey: Buffer): Promise<CaseWithPatient<T>[]> {
      const rows = await db.medicalCase.findMany({
        where: { deletedAt: null },
        include: { patient: { select: { id: true, fullName: true, employeeId: true } } },
        orderBy: { updatedAt: 'desc' }
      });
      return rows.map((row) => ({ ...decryptCase<T>(row, masterKey), patient: row.patient }));
    },

    /** Single case with the patient joined in, for the case detail workspace. */
    async findByIdWithPatient<T = unknown>(id: string, masterKey: Buffer): Promise<CaseWithPatient<T> | null> {
      const row = await db.medicalCase.findFirst({
        where: { id, deletedAt: null },
        include: { patient: { select: { id: true, fullName: true, employeeId: true } } }
      });
      return row ? { ...decryptCase<T>(row, masterKey), patient: row.patient } : null;
    },

    /**
     * Scoped to one clinician's assignments, with the patient's non-encrypted
     * name/employeeId columns joined in — the doctor dashboard needs "who is
     * this case for" without decrypting the full candidate profile payload.
     */
    async listForClinician<T = unknown>(clinicianId: string, masterKey: Buffer): Promise<CaseWithPatient<T>[]> {
      const rows = await db.medicalCase.findMany({
        where: { assignedClinicianId: clinicianId, deletedAt: null },
        include: { patient: { select: { id: true, fullName: true, employeeId: true } } },
        orderBy: { updatedAt: 'desc' }
      });
      return rows.map((row) => ({ ...decryptCase<T>(row, masterKey), patient: row.patient }));
    },

    /** Scoped to one patient's own cases (their dashboard/medical history) — patientId is PatientProfile.id, not the linked login user id. */
    async listForPatient<T = unknown>(patientId: string, masterKey: Buffer): Promise<CaseWithPatient<T>[]> {
      const rows = await db.medicalCase.findMany({
        where: { patientId, deletedAt: null },
        include: { patient: { select: { id: true, fullName: true, employeeId: true } } },
        orderBy: { updatedAt: 'desc' }
      });
      return rows.map((row) => ({ ...decryptCase<T>(row, masterKey), patient: row.patient }));
    },

    /**
     * Sets the clinician column (not just the encrypted payload) —
     * listForClinician/listForPatient filter on this real column, so the
     * patient intake form's doctor choice has to land here too.
     * `assignedAt` is stamped every time this runs (a first hand-off, a
     * bounce-back to the doctor stage, or a plain reassignment while the
     * case sits in a doctor's inbox) — it's meant to read as "since when has
     * this been this clinician's case", not just "when did the case first
     * ever reach the doctor stage".
     */
    setAssignedClinician(id: string, assignedClinicianId: string): Promise<MedicalCase> {
      return db.medicalCase.update({ where: { id }, data: { assignedClinicianId, assignedAt: new Date() } });
    },

    /**
     * Sets billing directly on the case row — an admin/reviewer's manual override of the amount a
     * doctor is billed (the doctor-submission snapshot is a separate write inside
     * submissionsRepository.saveAndTransition's own transaction, not this method). Never reads the
     * doctor's *current* rate itself; callers decide what value to write.
     */
    setBilling(id: string, payableAmount: number | null, paymentStatus: string | null): Promise<MedicalCase> {
      return db.medicalCase.update({ where: { id }, data: { payableAmount, paymentStatus } });
    },

    /**
     * Marks a case paid and records the real "doctor paid" instant in one statement — a prior
     * version did these as two separate UPDATEs (setPaymentStatus + a standalone
     * paymentConfirmedAt write), which could leave a case marked 'paid' with no confirmed-at
     * timestamp if the second one failed. The timestamp itself feeds the SLA manager's "time to
     * pay" / end-to-end targets (features/cases/sla.ts), which need it queryable on every
     * case-list row — the audit event's own `paidOn` detail (case-history.ts) can't offer that
     * without an N+1 lookup.
     */
    confirmPayment(id: string, paymentConfirmedAt: Date): Promise<MedicalCase> {
      return db.medicalCase.update({ where: { id }, data: { paymentStatus: 'paid', paymentConfirmedAt } });
    },

    /** Overwrites the encrypted payload only — used for the patient intake form's save-progress/submit, which never touches status/version directly (that's `transition`'s job). */
    async updatePayload(id: string, payload: unknown, masterKey: Buffer): Promise<MedicalCase> {
      const record = encryptJson(masterKey, payload ?? {});
      const casePayload = Buffer.from(JSON.stringify(record), 'utf8');
      return db.medicalCase.update({ where: { id }, data: { casePayload } });
    },

    async create(input: NewCaseInput, masterKey: Buffer): Promise<MedicalCase> {
      const record = encryptJson(masterKey, input.payload ?? {});
      const casePayload = Buffer.from(JSON.stringify(record), 'utf8');
      return db.medicalCase.create({
        data: {
          id: input.id,
          patientId: input.patientId,
          createdBy: input.createdBy,
          assignedOfficeId: input.assignedOfficeId,
          assignedClinicianId: input.assignedClinicianId,
          route: input.route,
          status: input.status,
          casePayload,
          payloadKeyVersion: 1,
          version: 1
        }
      });
    },

    async transition(
      caseId: string,
      expectedVersion: number,
      newStatus: string,
      actorId: string
    ): Promise<number> {
      const rows = await db.$queryRaw<{ transition_medical_case: number }[]>`
        SELECT transition_medical_case(${caseId}::varchar, ${expectedVersion}::integer, ${newStatus}::varchar, ${actorId}::varchar) AS transition_medical_case
      `;
      const row = rows[0];
      if (!row) {
        throw new Error('Medical case changed or does not exist');
      }
      return row.transition_medical_case;
    },

    /**
     * Atomically: saves the patient intake form's final payload, records the chosen doctor on the
     * case's own column, and calls the version-checked transition_medical_case stored procedure —
     * all in one DB transaction. A prior version ran these as three independent statements ending
     * in the version check; a concurrent modification (another tab, a reviewer hiding the case)
     * between the payload write and the transition could leave the case fully updated with the
     * patient's answers and a newly assigned doctor, yet still sitting at its old status — the
     * submission would look silently lost from the workflow's perspective. A version mismatch now
     * rolls back the payload/clinician writes too, matching submissionsRepository.saveAndTransition's
     * same fix for the doctor-submission path.
     */
    async submitAndTransition(
      input: {
        caseId: string;
        payload: unknown;
        assignedClinicianId: string;
        expectedVersion: number;
        newStatus: string;
        actorId: string;
      },
      masterKey: Buffer
    ): Promise<{ newVersion: number; previousStatus: string | null }> {
      return db.$transaction(async (tx) => {
        const record = encryptJson(masterKey, input.payload ?? {});
        const casePayload = Buffer.from(JSON.stringify(record), 'utf8');
        await tx.medicalCase.update({ where: { id: input.caseId }, data: { casePayload } });
        await tx.medicalCase.update({
          where: { id: input.caseId },
          data: { assignedClinicianId: input.assignedClinicianId, assignedAt: new Date() }
        });

        const before = await tx.medicalCase.findFirst({ where: { id: input.caseId }, select: { status: true } });

        const rows = await tx.$queryRaw<{ transition_medical_case: number }[]>`
          SELECT transition_medical_case(${input.caseId}::varchar, ${input.expectedVersion}::integer, ${input.newStatus}::varchar, ${input.actorId}::varchar) AS transition_medical_case
        `;
        const row = rows[0];
        if (!row) {
          throw new Error('Medical case changed or does not exist');
        }

        return { newVersion: row.transition_medical_case, previousStatus: before?.status ?? null };
      });
    }
  };
}

export const casesRepository = createCasesRepository(prisma);
