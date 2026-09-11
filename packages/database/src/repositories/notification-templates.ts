import type { NotificationTemplate, PrismaClient } from '../generated/client/index.js';
import { prisma } from '../client.js';

export interface NotificationTemplateInput {
  key: string;
  label: string;
  subject: string;
  body: string;
  bodyMode?: string;
  ccEmails?: string | null;
  bccEmails?: string | null;
  backgroundColor?: string | null;
  enabled?: boolean;
}

/**
 * One row per notification type (see apps/web's features/notifications/registry.ts for the
 * fixed set of keys this app actually sends). Rows are seeded lazily — a key with no saved row
 * yet falls back to the registry's own default subject/body (see notification-service.ts's
 * getTemplate) — so there's no separate "seed" migration step to keep in sync as new
 * notification types get added to the registry over time.
 */
export function createNotificationTemplatesRepository(db: PrismaClient) {
  return {
    list(): Promise<NotificationTemplate[]> {
      return db.notificationTemplate.findMany({ orderBy: { key: 'asc' } });
    },

    findByKey(key: string): Promise<NotificationTemplate | null> {
      return db.notificationTemplate.findUnique({ where: { key } });
    },

    upsert(input: NotificationTemplateInput, updatedBy?: string): Promise<NotificationTemplate> {
      const { key, ...rest } = input;
      return db.notificationTemplate.upsert({
        where: { key },
        create: { key, ...rest, enabled: rest.enabled ?? true, updatedBy },
        update: { ...rest, enabled: rest.enabled ?? true, updatedBy }
      });
    }
  };
}

export const notificationTemplatesRepository = createNotificationTemplatesRepository(prisma);
