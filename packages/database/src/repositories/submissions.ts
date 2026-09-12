import { createHash } from 'node:crypto';
import { decryptJson, encryptJson, type EncryptedRecord } from '@ncb/shared';
import type { MedicalSubmission, PrismaClient } from '../generated/client/index.js';
import { prisma } from '../client.js';

export interface SubmissionInput {
  id: string;
  caseId: string;
  submittedBy?: string;
  submissionVersion?: number;
  payload: unknown;
}

function sha256OfBuffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function decryptSubmission<T = unknown>(row: MedicalSubmission, masterKey: Buffer): T {
  const record = JSON.parse(Buffer.from(row.encryptedPayload).toString('utf8')) as EncryptedRecord;
  return decryptJson<T>(masterKey, record);
}

export function createSubmissionsRepository(db: PrismaClient) {
  return {
    listAll(): Promise<MedicalSubmission[]> {
      return db.medicalSubmission.findMany();
    },

    findById(id: string): Promise<MedicalSubmission | null> {
      return db.medicalSubmission.findFirst({ where: { id } });
    },

    listForCase(caseId: string): Promise<MedicalSubmission[]> {
      // submittedAt is a tiebreaker, not the primary key of the sort — two rows can otherwise share
      // a submissionVersion (see the comment on `save`'s default below for how that happened
      // historically), and without it Postgres doesn't guarantee which of them sorts first, which
      // is exactly how a resubmission could show up as "older" than the assessment it replaced.
      return db.medicalSubmission.findMany({
        where: { caseId },
        orderBy: [{ submissionVersion: 'desc' }, { submittedAt: 'desc' }]
      });
    },

    decrypt: decryptSubmission,

    /**
     * A resubmission (case sent back to the doctor, who edits and submits
     * again) never updates the earlier row — each submit is its own
     * immutable record, `submissionVersion` ordering them. `input.submissionVersion`
     * defaulting to 1 here is only ever right for a case's very first
     * submission; callers resubmitting the same case MUST pass the actual
     * next version (see submissions-service.ts's createSubmission, which
     * derives it from listForCase) — otherwise two rows tie at version 1 and
     * `listForCase`'s ordering can no longer tell which one is newer.
     */
    async save(input: SubmissionInput, masterKey: Buffer): Promise<MedicalSubmission> {
      const record = encryptJson(masterKey, input.payload);
      const encryptedPayload = Buffer.from(JSON.stringify(record), 'utf8');
      const payloadSha256 = sha256OfBuffer(encryptedPayload);
      return db.medicalSubmission.create({
        data: {
          id: input.id,
          caseId: input.caseId,
          submittedBy: input.submittedBy,
          submissionVersion: input.submissionVersion ?? 1,
          encryptedPayload,
          payloadKeyVersion: 1,
          payloadSha256
        }
      });
    },

    /** Defense-in-depth check independent of the GCM auth tag. */
    async verifyIntegrity(id: string): Promise<boolean> {
      const row = await db.medicalSubmission.findFirst({ where: { id } });
      if (!row) return false;
      return sha256OfBuffer(Buffer.from(row.encryptedPayload)) === row.payloadSha256;
    },

    /**
     * Atomically: computes the next submission version, inserts the submission row, optionally
     * updates billing, and calls the version-checked transition_medical_case stored procedure —
     * all in one DB transaction. Previously these were three independent statements (see
     * create-submission.ts's own history) with no shared rollback: a stale expectedVersion could
     * fail the transition after the submission (and billing change) had already been persisted,
     * leaving them orphaned with no matching case transition. `buildPayload` receives the
     * transaction-computed version so the caller's payload shape (owned by apps/web, not this
     * repository) can include it without a second round trip.
     */
    async saveAndTransition(
      input: {
        id: string;
        caseId: string;
        submittedBy?: string;
        expectedVersion: number;
        newStatus: string;
        actorId: string;
        billing?: { payableAmount: number; paymentStatus: string };
      },
      masterKey: Buffer,
      buildPayload: (submissionVersion: number) => unknown
    ): Promise<{ payload: unknown; submissionVersion: number; newCaseVersion: number; previousStatus: string | null }> {
      return db.$transaction(async (tx) => {
        const existing = await tx.medicalSubmission.findMany({
          where: { caseId: input.caseId },
          orderBy: [{ submissionVersion: 'desc' }, { submittedAt: 'desc' }],
          take: 1,
          select: { submissionVersion: true }
        });
        const submissionVersion = (existing[0]?.submissionVersion ?? 0) + 1;

        const payload = buildPayload(submissionVersion);
        const record = encryptJson(masterKey, payload);
        const encryptedPayload = Buffer.from(JSON.stringify(record), 'utf8');
        const payloadSha256 = sha256OfBuffer(encryptedPayload);
        await tx.medicalSubmission.create({
          data: {
            id: input.id,
            caseId: input.caseId,
            submittedBy: input.submittedBy,
            submissionVersion,
            encryptedPayload,
            payloadKeyVersion: 1,
            payloadSha256
          }
        });

        if (input.billing) {
          await tx.medicalCase.update({
            where: { id: input.caseId },
            data: { payableAmount: input.billing.payableAmount, paymentStatus: input.billing.paymentStatus }
          });
        }

        const before = await tx.medicalCase.findFirst({ where: { id: input.caseId }, select: { status: true } });

        const rows = await tx.$queryRaw<{ transition_medical_case: number }[]>`
          SELECT transition_medical_case(${input.caseId}::varchar, ${input.expectedVersion}::integer, ${input.newStatus}::varchar, ${input.actorId}::varchar) AS transition_medical_case
        `;
        const row = rows[0];
        if (!row) {
          throw new Error('Medical case changed or does not exist');
        }

        return { payload, submissionVersion, newCaseVersion: row.transition_medical_case, previousStatus: before?.status ?? null };
      });
    }
  };
}

export const submissionsRepository = createSubmissionsRepository(prisma);
