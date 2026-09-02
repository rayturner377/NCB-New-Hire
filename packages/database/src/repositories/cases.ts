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
        SELECT transition_medical_case(${caseId}, ${expectedVersion}, ${newStatus}, ${actorId}) AS transition_medical_case
      `;
      const row = rows[0];
      if (!row) {
        throw new Error('Medical case changed or does not exist');
      }
      return row.transition_medical_case;
    }
  };
}

export const casesRepository = createCasesRepository(prisma);
