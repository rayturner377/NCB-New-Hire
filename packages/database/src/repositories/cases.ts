import { decryptJson, encryptJson, type EncryptedRecord } from '@ncb/shared';
import type { MedicalCase, Prisma, PrismaClient } from '../generated/client/index.js';
import { prisma } from '../client.js';
import type { PaginatedResult } from '../pagination.js';
import { buildCaseBillingWhere } from './case-billing-where.js';

export interface CaseSearchFilters {
  /** Matched against the joined patient's fullName — case-insensitive, substring. */
  query?: string;
  status?: string;
  /** Same billing classification as billing-status.ts's derivedPaymentStatus, translated to SQL so it composes correctly with pagination instead of being applied after an in-memory decrypt. */
  billing?: 'paid' | 'unpaid' | 'not_payable' | '';
  /** Inclusive "YYYY-MM-DD", applied to createdAt. */
  from?: string;
  to?: string;
}

/**
 * The SQL equivalent of cases-container.tsx's old in-memory filter — every clause here has to stay
 * behaviorally identical to derivedPaymentStatus's own rules (billing-status.ts) since this is the
 * one place that logic is reimplemented as a `where` instead of a post-fetch predicate. Built as an
 * `AND` array (not a shared `where.status`/`where.paymentStatus` object) so `status` and `billing`
 * can both be active at once without one clobbering the other's own use of the same column.
 */
export function buildCaseSearchWhere(filters: CaseSearchFilters): Prisma.MedicalCaseWhereInput {
  const and: Prisma.MedicalCaseWhereInput[] = [{ deletedAt: null }];

  if (filters.query) {
    and.push({ patient: { fullName: { contains: filters.query, mode: 'insensitive' } } });
  }
  if (filters.status) {
    and.push({ status: filters.status });
  }
  const billingWhere = buildCaseBillingWhere(filters.billing);
  if (billingWhere) {
    and.push(billingWhere);
  }
  if (filters.from) {
    and.push({ createdAt: { gte: new Date(`${filters.from}T00:00:00.000Z`) } });
  }
  if (filters.to) {
    and.push({ createdAt: { lte: new Date(`${filters.to}T23:59:59.999Z`) } });
  }

  return { AND: and };
}

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

/** Thrown by updatePayload when an `expectedVersion` is given and no longer matches — see its own doc comment. Callers can catch this specifically (`instanceof`) rather than string-matching a message. */
export class CaseVersionConflictError extends Error {
  constructor() {
    super('This case was changed since you loaded it — refresh and try again.');
    this.name = 'CaseVersionConflictError';
  }
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

    /**
     * The paginated, filtered equivalent of listAllWithPatient — every filter here (query/status/
     * billing/date range) only ever touches plain columns (see buildCaseSearchWhere), so the `where`
     * clause narrows the result set in SQL before anything is fetched, and only the returned page
     * gets decrypted, not the whole table. Used by the "All cases" tab (cases-container.tsx).
     */
    async searchWithPatient<T = unknown>(
      filters: CaseSearchFilters,
      page: number,
      pageSize: number,
      masterKey: Buffer
    ): Promise<PaginatedResult<CaseWithPatient<T>>> {
      const where = buildCaseSearchWhere(filters);
      const [rows, total] = await Promise.all([
        db.medicalCase.findMany({
          where,
          include: { patient: { select: { id: true, fullName: true, employeeId: true } } },
          // `id` breaks ties between rows with the identical updatedAt (plausible for a batch of
          // records touched together, e.g. a migration/backfill) — without it, Postgres doesn't
          // guarantee the same relative order across separate paginated queries, which can show a
          // row twice or skip one entirely across a page boundary.
          orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize
        }),
        db.medicalCase.count({ where })
      ]);
      return { rows: rows.map((row) => ({ ...decryptCase<T>(row, masterKey), patient: row.patient })), total };
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
     * Scoped to a specific set of patients via `patientId IN (...)` — for the candidates list's
     * per-candidate case-count/history summary, which only ever needs cases for the candidates on
     * the current page, not every case in the system. Returns [] without querying at all for an
     * empty list, rather than letting an empty `IN ()` clause reach Postgres.
     */
    async listForPatients<T = unknown>(patientIds: string[], masterKey: Buffer): Promise<CaseWithPatient<T>[]> {
      if (patientIds.length === 0) return [];
      const rows = await db.medicalCase.findMany({
        where: { patientId: { in: patientIds }, deletedAt: null },
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

    /**
     * Overwrites the encrypted payload — used for the patient intake form's save-progress/submit
     * and the doctor assessment draft's autosave. Never touches `status` directly (that's
     * `transition`'s job), but DOES increment `version` on every write that supplies an
     * `expectedVersion` — confirmed via external security review that the previous version of this
     * method checked a version but never actually advanced it, so the conditional `updateMany`
     * below could match and succeed for TWO concurrent editors in a row, back to back, since neither
     * write ever changed the value the other was checking against. A version check that never
     * changes the thing it checks isn't optimistic concurrency, it's a no-op.
     *
     * This only actually protects against a lost update if the caller's `expectedVersion` is the
     * version their OWN editor genuinely last saw — not one freshly re-read by the server in the
     * same request, which would trivially always match itself. See saveDoctorAssessmentDraft's own
     * doc comment for how the caller keeps that value current across repeated autosaves without
     * self-conflicting.
     *
     * Throws CaseVersionConflictError on a mismatch rather than silently overwriting. Omit
     * `expectedVersion` entirely for a caller with no meaningful version context of its own to check
     * against (e.g. clearDoctorAssessmentDraft's internal post-submission cleanup) — this is the
     * only case that still skips the check/increment altogether.
     *
     * `plainColumns` is an escape hatch for the handful of un-encrypted columns a payload save
     * sometimes needs to touch alongside it in the same statement — currently just
     * lastEditedById/lastEditedAt (see saveDoctorAssessmentDraft), not meant to grow into a
     * general-purpose update method.
     */
    async updatePayload(
      id: string,
      payload: unknown,
      masterKey: Buffer,
      plainColumns?: { lastEditedById?: string | null; lastEditedAt?: Date | null },
      expectedVersion?: number
    ): Promise<MedicalCase> {
      const record = encryptJson(masterKey, payload ?? {});
      const casePayload = Buffer.from(JSON.stringify(record), 'utf8');

      if (expectedVersion === undefined) {
        return db.medicalCase.update({ where: { id }, data: { casePayload, ...plainColumns } });
      }

      const { count } = await db.medicalCase.updateMany({
        where: { id, version: expectedVersion },
        data: { casePayload, ...plainColumns, version: { increment: 1 } }
      });
      if (count === 0) {
        throw new CaseVersionConflictError();
      }
      return db.medicalCase.findFirstOrThrow({ where: { id } });
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
