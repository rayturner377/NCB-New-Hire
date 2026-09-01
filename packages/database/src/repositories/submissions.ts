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
      return db.medicalSubmission.findMany({
        where: { caseId },
        orderBy: { submissionVersion: 'desc' }
      });
    },

    decrypt: decryptSubmission,

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
