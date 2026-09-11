import { randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../../../generated/client/index.js';
import { createSettingsRepository } from '../../settings.js';

describe('settings repository', () => {
  const masterKey = randomBytes(32);

  it('round-trips a settings object through write() then read()', async () => {
    let stored: Buffer | undefined;

    const db = {
      applicationSetting: {
        upsert: vi.fn().mockImplementation(({ create }: { create: { encryptedValue: Buffer } }) => {
          stored = create.encryptedValue;
          return Promise.resolve({});
        }),
        findUnique: vi.fn().mockImplementation(() =>
          Promise.resolve(stored ? { settingKey: 'app_settings', encryptedValue: stored } : null)
        )
      }
    } as unknown as PrismaClient;

    const repository = createSettingsRepository(db);
    const settings = { organizationName: 'National Commercial Bank Jamaica', notificationEmail: 'hr@ncb.local' };

    await repository.write(settings, masterKey, 'user_admin_1');
    const result = await repository.read(masterKey);

    expect(result).toEqual(settings);
  });

  it('returns null when no settings row exists yet', async () => {
    const db = {
      applicationSetting: {
        findUnique: vi.fn().mockResolvedValue(null)
      }
    } as unknown as PrismaClient;

    const repository = createSettingsRepository(db);
    expect(await repository.read(masterKey)).toBeNull();
  });

  it('rejects reading with the wrong master key', async () => {
    let stored: Buffer | undefined;
    const db = {
      applicationSetting: {
        upsert: vi.fn().mockImplementation(({ create }: { create: { encryptedValue: Buffer } }) => {
          stored = create.encryptedValue;
          return Promise.resolve({});
        }),
        findUnique: vi.fn().mockImplementation(() =>
          Promise.resolve(stored ? { settingKey: 'app_settings', encryptedValue: stored } : null)
        )
      }
    } as unknown as PrismaClient;

    const repository = createSettingsRepository(db);
    await repository.write({ a: 1 }, masterKey);

    const wrongKey = randomBytes(32);
    await expect(repository.read(wrongKey)).rejects.toThrow();
  });
});
