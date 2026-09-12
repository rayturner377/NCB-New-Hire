import { rm } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { deleteAttachmentFile, readAttachmentFile, saveAttachmentFile } from '../../attachment-storage';

const ATTACHMENTS_DIR = path.join(process.cwd(), 'data', 'attachments');
const testKey = `test-attachment-${Date.now()}.bin`;

describe('attachment storage', () => {
  afterAll(async () => {
    await rm(ATTACHMENTS_DIR, { recursive: true, force: true });
  });

  it('round-trips a saved file back out byte-for-byte', async () => {
    const data = Buffer.from('hello attachment');
    await saveAttachmentFile(testKey, data);

    const read = await readAttachmentFile(testKey);

    expect(read.equals(data)).toBe(true);
  });

  it('deleteAttachmentFile removes the file and never throws for a file that is already gone', async () => {
    await saveAttachmentFile(testKey, Buffer.from('x'));
    await deleteAttachmentFile(testKey);

    await expect(readAttachmentFile(testKey)).rejects.toThrow();
    await expect(deleteAttachmentFile(testKey)).resolves.toBeUndefined();
  });

  it('rejects a storageKey attempting path traversal', async () => {
    await expect(saveAttachmentFile('../escape.bin', Buffer.from('x'))).rejects.toThrow('Invalid attachment storage key.');
    await expect(saveAttachmentFile('sub/dir.bin', Buffer.from('x'))).rejects.toThrow('Invalid attachment storage key.');
  });
});
