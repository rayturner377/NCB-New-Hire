import type { EmailMessage, PrismaClient } from '../generated/client/index.js';
import { prisma } from '../client.js';

export interface EmailMessageInput {
  id: string;
  templateKey?: string | null;
  toEmail: string;
  ccEmails?: string | null;
  bccEmails?: string | null;
  subject: string;
  bodyHtml: string;
  status: 'sent' | 'failed';
  errorMessage?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}

export interface EmailMessageFilters {
  status?: string;
  /** Case-insensitive match against the recipient address or subject line — the Message Centre's search box. */
  query?: string;
}

/** The Message Centre's whole data source — one row per attempted send, regardless of outcome (see notification-service.ts's sendNotification, the only writer). */
export function createEmailMessagesRepository(db: PrismaClient) {
  return {
    create(input: EmailMessageInput): Promise<EmailMessage> {
      return db.emailMessage.create({ data: input });
    },

    findById(id: string): Promise<EmailMessage | null> {
      return db.emailMessage.findUnique({ where: { id } });
    },

    /** Used by the Message Centre's resend action to overwrite a failed row's own outcome in place, rather than creating a second row for the same logical send attempt. */
    updateStatus(id: string, status: 'sent' | 'failed', errorMessage: string | null): Promise<EmailMessage> {
      return db.emailMessage.update({ where: { id }, data: { status, errorMessage } });
    },

    async query(filters: EmailMessageFilters, page: number, pageSize: number): Promise<{ rows: EmailMessage[]; total: number }> {
      const where = {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.query
          ? {
              OR: [
                { toEmail: { contains: filters.query, mode: 'insensitive' as const } },
                { subject: { contains: filters.query, mode: 'insensitive' as const } }
              ]
            }
          : {})
      };
      const [rows, total] = await Promise.all([
        db.emailMessage.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
        db.emailMessage.count({ where })
      ]);
      return { rows, total };
    },

    counts(): Promise<{ total: number; sent: number; failed: number }> {
      return Promise.all([db.emailMessage.count(), db.emailMessage.count({ where: { status: 'sent' } }), db.emailMessage.count({ where: { status: 'failed' } })]).then(
        ([total, sent, failed]) => ({ total, sent, failed })
      );
    }
  };
}

export const emailMessagesRepository = createEmailMessagesRepository(prisma);
