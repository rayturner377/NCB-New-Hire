import type { CaseAttachment, PrismaClient } from '../generated/client/index.js';
import { prisma } from '../client.js';

export interface CreateCaseAttachmentInput {
  id: string;
  caseId: string;
  uploadedBy: string;
  storageKey: string;
  originalName: string;
  contentType: string;
  byteSize: number;
  sha256: string;
}

/**
 * Backs the case workspace's Documents tab — a generic file-per-case store
 * (`case_attachments`, present in the schema since 0001_init but never wired
 * to any repository/UI until now). `scanStatus` exists on the table for a
 * future antivirus-scan integration; this repository doesn't touch it beyond
 * the column default ('pending'), so nothing here claims a file is safe.
 */
export function createCaseAttachmentsRepository(db: PrismaClient) {
  return {
    create(input: CreateCaseAttachmentInput): Promise<CaseAttachment> {
      return db.caseAttachment.create({
        data: {
          id: input.id,
          caseId: input.caseId,
          uploadedBy: input.uploadedBy,
          storageKey: input.storageKey,
          originalName: input.originalName,
          contentType: input.contentType,
          byteSize: BigInt(input.byteSize),
          sha256: input.sha256
        }
      });
    },

    /** Newest first — matches every other per-case list in this app (history, submissions). */
    listForCase(caseId: string): Promise<CaseAttachment[]> {
      return db.caseAttachment.findMany({ where: { caseId, deletedAt: null }, orderBy: { createdAt: 'desc' } });
    },

    findById(id: string): Promise<CaseAttachment | null> {
      return db.caseAttachment.findFirst({ where: { id, deletedAt: null } });
    },

    /** Soft delete only — the underlying file on disk is left alone (see lib/attachment-storage.ts), matching how a medical case itself is never hard-deleted either. */
    softDelete(id: string): Promise<CaseAttachment> {
      return db.caseAttachment.update({ where: { id }, data: { deletedAt: new Date() } });
    }
  };
}

export const caseAttachmentsRepository = createCaseAttachmentsRepository(prisma);
