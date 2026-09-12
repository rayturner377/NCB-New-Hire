import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../../../generated/client/index.js';
import { createNotificationTemplatesRepository } from '../../notification-templates.js';

const baseInput = {
  key: 'case_reviewed',
  label: 'Case reviewed',
  subject: 'Your case has been reviewed',
  body: '<p>Update</p>'
};

describe('notification templates repository', () => {
  it('list() orders by key ascending', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const db = { notificationTemplate: { findMany } } as unknown as PrismaClient;

    await createNotificationTemplatesRepository(db).list();

    expect(findMany).toHaveBeenCalledWith({ orderBy: { key: 'asc' } });
  });

  it('findByKey() looks up by the unique key', async () => {
    const findUnique = vi.fn().mockResolvedValue(baseInput);
    const db = { notificationTemplate: { findUnique } } as unknown as PrismaClient;

    const found = await createNotificationTemplatesRepository(db).findByKey('case_reviewed');

    expect(findUnique).toHaveBeenCalledWith({ where: { key: 'case_reviewed' } });
    expect(found).toEqual(baseInput);
  });

  it('upsert() defaults enabled to true when omitted, on both create and update branches', async () => {
    const upsert = vi.fn().mockResolvedValue({ ...baseInput, enabled: true });
    const db = { notificationTemplate: { upsert } } as unknown as PrismaClient;

    await createNotificationTemplatesRepository(db).upsert(baseInput, 'usr_admin');

    const { key, ...rest } = baseInput;
    expect(upsert).toHaveBeenCalledWith({
      where: { key },
      create: { key, ...rest, enabled: true, updatedBy: 'usr_admin' },
      update: { ...rest, enabled: true, updatedBy: 'usr_admin' }
    });
  });

  it('upsert() respects an explicit enabled: false rather than defaulting it', async () => {
    const upsert = vi.fn().mockResolvedValue({ ...baseInput, enabled: false });
    const db = { notificationTemplate: { upsert } } as unknown as PrismaClient;

    await createNotificationTemplatesRepository(db).upsert({ ...baseInput, enabled: false });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ enabled: false }),
        update: expect.objectContaining({ enabled: false })
      })
    );
  });
});
