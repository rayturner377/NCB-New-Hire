import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../../../generated/client/index.js';
import { createEmailMessagesRepository } from '../../email-messages.js';

const baseInput = {
  id: 'msg_1',
  toEmail: 'someone@ncb.local',
  subject: 'Case update',
  bodyHtml: '<p>Hi</p>',
  status: 'sent' as const
};

describe('email messages repository', () => {
  it('create() passes the input straight through as the row data', async () => {
    const create = vi.fn().mockResolvedValue(baseInput);
    const db = { emailMessage: { create } } as unknown as PrismaClient;

    await createEmailMessagesRepository(db).create(baseInput);

    expect(create).toHaveBeenCalledWith({ data: baseInput });
  });

  it('findById() looks up by unique id', async () => {
    const findUnique = vi.fn().mockResolvedValue(baseInput);
    const db = { emailMessage: { findUnique } } as unknown as PrismaClient;

    const found = await createEmailMessagesRepository(db).findById('msg_1');

    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'msg_1' } });
    expect(found).toEqual(baseInput);
  });

  it('updateStatus() overwrites status and errorMessage on the existing row', async () => {
    const update = vi.fn().mockResolvedValue({ ...baseInput, status: 'failed' });
    const db = { emailMessage: { update } } as unknown as PrismaClient;

    await createEmailMessagesRepository(db).updateStatus('msg_1', 'failed', 'SMTP timeout');

    expect(update).toHaveBeenCalledWith({
      where: { id: 'msg_1' },
      data: { status: 'failed', errorMessage: 'SMTP timeout' }
    });
  });

  it('query() with no filters queries and counts with an empty where clause', async () => {
    const findMany = vi.fn().mockResolvedValue([baseInput]);
    const count = vi.fn().mockResolvedValue(1);
    const db = { emailMessage: { findMany, count } } as unknown as PrismaClient;

    const result = await createEmailMessagesRepository(db).query({}, 1, 20);

    expect(findMany).toHaveBeenCalledWith({ where: {}, orderBy: { createdAt: 'desc' }, skip: 0, take: 20 });
    expect(count).toHaveBeenCalledWith({ where: {} });
    expect(result).toEqual({ rows: [baseInput], total: 1 });
  });

  it('query() with status and a search query builds the combined where clause and pages correctly', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const db = { emailMessage: { findMany, count } } as unknown as PrismaClient;

    await createEmailMessagesRepository(db).query({ status: 'failed', query: 'invoice' }, 3, 10);

    const expectedWhere = {
      status: 'failed',
      OR: [
        { toEmail: { contains: 'invoice', mode: 'insensitive' } },
        { subject: { contains: 'invoice', mode: 'insensitive' } }
      ]
    };
    expect(findMany).toHaveBeenCalledWith({ where: expectedWhere, orderBy: { createdAt: 'desc' }, skip: 20, take: 10 });
    expect(count).toHaveBeenCalledWith({ where: expectedWhere });
  });

  it('counts() tallies total/sent/failed in parallel', async () => {
    const count = vi.fn().mockResolvedValueOnce(10).mockResolvedValueOnce(7).mockResolvedValueOnce(3);
    const db = { emailMessage: { count } } as unknown as PrismaClient;

    const result = await createEmailMessagesRepository(db).counts();

    expect(count).toHaveBeenNthCalledWith(1);
    expect(count).toHaveBeenNthCalledWith(2, { where: { status: 'sent' } });
    expect(count).toHaveBeenNthCalledWith(3, { where: { status: 'failed' } });
    expect(result).toEqual({ total: 10, sent: 7, failed: 3 });
  });
});
