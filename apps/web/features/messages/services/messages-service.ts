import { emailMessagesRepository } from '@ncb/database';
import { eventLabel } from '../../../lib/audit-event-labels';
import { findNotificationTemplateDefinition } from '../../notifications/registry';
import { TEST_EMAIL_TEMPLATE_KEY } from '../test-email';

export type MessageCategory = 'case' | 'account' | 'test' | 'other';

export interface MessageRow {
  id: string;
  to: string;
  subject: string;
  templateLabel: string;
  category: MessageCategory;
  status: string;
  createdAt: string;
}

export interface MessageDetail extends MessageRow {
  templateKey: string | null;
  cc: string | null;
  bcc: string | null;
  bodyHtml: string;
  errorMessage: string | null;
  entityType: string | null;
  entityId: string | null;
}

function templateLabelFor(templateKey: string | null): string {
  if (!templateKey) return 'Manual';
  if (templateKey === TEST_EMAIL_TEMPLATE_KEY) return 'Test email';
  return findNotificationTemplateDefinition(templateKey)?.label ?? eventLabel(templateKey);
}

/** Groups a template key into a broad category for the Message Centre's badge/icon — purely cosmetic, doesn't affect filtering. */
function categoryFor(templateKey: string | null): MessageCategory {
  if (!templateKey) return 'other';
  if (templateKey === TEST_EMAIL_TEMPLATE_KEY) return 'test';
  if (templateKey.startsWith('case_')) return 'case';
  if (templateKey === 'password_reset' || templateKey === 'account_created') return 'account';
  return 'other';
}

export interface MessageFilters {
  status?: string;
  query?: string;
}

export async function listMessages(filters: MessageFilters, page: number, pageSize: number): Promise<{ rows: MessageRow[]; total: number }> {
  const { rows, total } = await emailMessagesRepository.query(filters, page, pageSize);
  return {
    total,
    rows: rows.map((message) => ({
      id: message.id,
      to: message.toEmail,
      subject: message.subject,
      templateLabel: templateLabelFor(message.templateKey),
      category: categoryFor(message.templateKey),
      status: message.status,
      createdAt: message.createdAt.toISOString()
    }))
  };
}

export async function getMessageCounts() {
  return emailMessagesRepository.counts();
}

export async function getMessageDetail(id: string): Promise<MessageDetail | null> {
  const message = await emailMessagesRepository.findById(id);
  if (!message) return null;
  return {
    id: message.id,
    to: message.toEmail,
    templateKey: message.templateKey,
    cc: message.ccEmails,
    bcc: message.bccEmails,
    subject: message.subject,
    templateLabel: templateLabelFor(message.templateKey),
    category: categoryFor(message.templateKey),
    status: message.status,
    bodyHtml: message.bodyHtml,
    errorMessage: message.errorMessage,
    entityType: message.entityType,
    entityId: message.entityId,
    createdAt: message.createdAt.toISOString()
  };
}
