import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();
const countsMock = vi.fn();
const findByIdMock = vi.fn();
const findNotificationTemplateDefinitionMock = vi.fn();
const eventLabelMock = vi.fn((key: string) => `Label for ${key}`);

vi.mock('@ncb/database', () => ({
  emailMessagesRepository: {
    query: (...args: unknown[]) => queryMock(...args),
    counts: (...args: unknown[]) => countsMock(...args),
    findById: (...args: unknown[]) => findByIdMock(...args)
  }
}));
vi.mock('../../../../../lib/audit-event-labels', () => ({ eventLabel: (...args: [string]) => eventLabelMock(...args) }));
vi.mock('../../../../notifications/registry', () => ({
  findNotificationTemplateDefinition: (...args: unknown[]) => findNotificationTemplateDefinitionMock(...args)
}));

const { listMessages, getMessageCounts, getMessageDetail } = await import('../../messages-service');

const baseMessage = {
  id: 'msg_1',
  toEmail: 'someone@ncb.local',
  ccEmails: null,
  bccEmails: null,
  subject: 'Hello',
  bodyHtml: '<p>Hi</p>',
  status: 'sent',
  errorMessage: null,
  entityType: null,
  entityId: null,
  templateKey: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z')
};

describe('messages service', () => {
  beforeEach(() => {
    queryMock.mockReset();
    countsMock.mockReset();
    findByIdMock.mockReset();
    findNotificationTemplateDefinitionMock.mockReset();
    eventLabelMock.mockClear();
  });

  describe('listMessages', () => {
    it('labels a manual send (no template) as "Manual"/"other"', async () => {
      queryMock.mockResolvedValue({ rows: [baseMessage], total: 1 });

      const { rows } = await listMessages({}, 1, 20);

      expect(rows[0]).toMatchObject({ templateLabel: 'Manual', category: 'other' });
    });

    it('labels the reserved test-email template key as "Test email"/"test"', async () => {
      queryMock.mockResolvedValue({ rows: [{ ...baseMessage, templateKey: 'test_email' }], total: 1 });

      const { rows } = await listMessages({}, 1, 20);

      expect(rows[0]).toMatchObject({ templateLabel: 'Test email', category: 'test' });
    });

    it('categorizes a case_ prefixed template as "case" and uses the registry label when found', async () => {
      findNotificationTemplateDefinitionMock.mockReturnValue({ label: 'Case Reviewed' });
      queryMock.mockResolvedValue({ rows: [{ ...baseMessage, templateKey: 'case_reviewed' }], total: 1 });

      const { rows } = await listMessages({}, 1, 20);

      expect(rows[0]).toMatchObject({ templateLabel: 'Case Reviewed', category: 'case' });
    });

    it('falls back to eventLabel when the registry has no definition for the key', async () => {
      findNotificationTemplateDefinitionMock.mockReturnValue(undefined);
      queryMock.mockResolvedValue({ rows: [{ ...baseMessage, templateKey: 'password_reset' }], total: 1 });

      const { rows } = await listMessages({}, 1, 20);

      expect(rows[0]).toMatchObject({ templateLabel: 'Label for password_reset', category: 'account' });
    });
  });

  it('getMessageCounts() delegates to the repository', async () => {
    countsMock.mockResolvedValue({ total: 5, sent: 4, failed: 1 });
    expect(await getMessageCounts()).toEqual({ total: 5, sent: 4, failed: 1 });
  });

  describe('getMessageDetail', () => {
    it('returns null when no message matches', async () => {
      findByIdMock.mockResolvedValue(null);
      expect(await getMessageDetail('missing')).toBeNull();
    });

    it('shapes the full detail including cc/bcc/body/error when found', async () => {
      findByIdMock.mockResolvedValue(baseMessage);

      const detail = await getMessageDetail('msg_1');

      expect(detail).toMatchObject({ id: 'msg_1', bodyHtml: '<p>Hi</p>', templateLabel: 'Manual' });
    });
  });
});
