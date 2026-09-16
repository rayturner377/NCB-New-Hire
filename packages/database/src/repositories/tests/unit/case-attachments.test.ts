import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../../../generated/client/index.js';
import { createCaseAttachmentsRepository } from '../../case-attachments.js';

describe('case attachments repository', () => {
  it('create() converts byteSize to a BigInt and passes through the rest', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'att_1' });
    const db = { caseAttachment: { create } } as unknown as PrismaClient;

    await createCaseAttachmentsRepository(db).create({
      id: 'att_1',
      caseId: 'case_1',
      uploadedBy: 'user_1',
      storageKey: 'key_1',
      originalName: 'report.pdf',
      contentType: 'application/pdf',
      byteSize: 2048,
      sha256: 'abc123'
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        id: 'att_1',
        caseId: 'case_1',
        uploadedBy: 'user_1',
        storageKey: 'key_1',
        originalName: 'report.pdf',
        contentType: 'application/pdf',
        byteSize: 2048n,
        sha256: 'abc123'
      }
    });
  });

  it('listForCase() excludes soft-deleted rows and orders newest first', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const db = { caseAttachment: { findMany } } as unknown as PrismaClient;

    await createCaseAttachmentsRepository(db).listForCase('case_1');

    expect(findMany).toHaveBeenCalledWith({
      where: { caseId: 'case_1', deletedAt: null },
      orderBy: { createdAt: 'desc' }
    });
  });

  it('findById() excludes soft-deleted rows', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'att_1' });
    const db = { caseAttachment: { findFirst } } as unknown as PrismaClient;

    const found = await createCaseAttachmentsRepository(db).findById('att_1');

    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'att_1', deletedAt: null } });
    expect(found).toEqual({ id: 'att_1' });
  });

  it('softDelete() sets deletedAt rather than removing the row', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'att_1', deletedAt: new Date() });
    const db = { caseAttachment: { update } } as unknown as PrismaClient;

    await createCaseAttachmentsRepository(db).softDelete('att_1');

    expect(update).toHaveBeenCalledWith({ where: { id: 'att_1' }, data: { deletedAt: expect.any(Date) } });
  });

  it('updateScanStatus() sets the given status', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'att_1', scanStatus: 'clean' });
    const db = { caseAttachment: { update } } as unknown as PrismaClient;

    await createCaseAttachmentsRepository(db).updateScanStatus('att_1', 'clean');

    expect(update).toHaveBeenCalledWith({ where: { id: 'att_1' }, data: { scanStatus: 'clean' } });
  });
});
