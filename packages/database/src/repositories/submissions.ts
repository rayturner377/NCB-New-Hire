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
    }
  };
}

export const submissionsRepository = createSubmissionsRepository(prisma);
