import { decryptJson, encryptJson, type EncryptedRecord } from '@ncb/shared';
import type { PrismaClient } from '../generated/client/index.js';
import { prisma } from '../client.js';

const SETTINGS_KEY = 'app_settings';

/**
 * The whole sanitized settings object is stored as one encrypted envelope in a
 * single row, keyed by SETTINGS_KEY. The old file-based settings-specific
 * encryptStoredSecret/decryptStoredSecret per-field double-encryption (server.js
 * ~L4394-4399) is not needed here — the row is already encrypted end-to-end.
 */
export function createSettingsRepository(db: PrismaClient) {
  return {
    async read<T = unknown>(masterKey: Buffer): Promise<T | null> {
      const row = await db.applicationSetting.findUnique({ where: { settingKey: SETTINGS_KEY } });
      if (!row) return null;
      const record = JSON.parse(Buffer.from(row.encryptedValue).toString('utf8')) as EncryptedRecord;
      return decryptJson<T>(masterKey, record);
    },

    async write(settings: unknown, masterKey: Buffer, updatedBy?: string): Promise<void> {
      const record = encryptJson(masterKey, settings);
      const encryptedValue = Buffer.from(JSON.stringify(record), 'utf8');
      await db.applicationSetting.upsert({
        where: { settingKey: SETTINGS_KEY },
        create: { settingKey: SETTINGS_KEY, encryptedValue, updatedBy },
        update: { encryptedValue, updatedBy }
      });
    }
  };
}

export const settingsRepository = createSettingsRepository(prisma);
