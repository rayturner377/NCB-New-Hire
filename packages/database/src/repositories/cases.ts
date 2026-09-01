import type { MedicalCase, PrismaClient } from '../generated/client/index.js';
import { prisma } from '../client.js';

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
    listAll(): Promise<MedicalCase[]> {
      return db.medicalCase.findMany({ where: { deletedAt: null } });
    },

    findById(id: string): Promise<MedicalCase | null> {
      return db.medicalCase.findFirst({ where: { id, deletedAt: null } });
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
