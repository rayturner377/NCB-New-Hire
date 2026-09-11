import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const upsertMock = vi.fn();
const auditAppendMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePathMock(...args) }));
vi.mock('../../../../../lib/assert-same-origin', () => ({ assertSameOrigin: async () => undefined }));
vi.mock('../../../../../lib/session', () => ({ getSession: (...args: unknown[]) => getSessionMock(...args) }));
vi.mock('@ncb/database', () => ({
  notificationTemplatesRepository: { upsert: (...args: unknown[]) => upsertMock(...args) },
  auditRepository: { append: (...args: unknown[]) => auditAppendMock(...args) }
}));

const { updateTemplateAction } = await import('../../update-template');

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe('updateTemplateAction', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    upsertMock.mockReset();
    auditAppendMock.mockReset();
    revalidatePathMock.mockClear();
    getSessionMock.mockResolvedValue({ user: { id: 'usr_admin_demo', role: 'admin' } });
  });

  it('saves an ordinary notification template with CC/BCC provided', async () => {
    const result = await updateTemplateAction(
      null,
      formData({
        key: 'case_reviewed',
        subject: 'Subject line',
        body: '<p>Body</p>',
        bodyMode: 'text',
        ccEmails: 'cc@ncb.local',
        bccEmails: 'bcc@ncb.local'
      })
    );

    expect(result.ok).toBe(true);
    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({ key: 'case_reviewed', ccEmails: 'cc@ncb.local', bccEmails: 'bcc@ncb.local' }), 'usr_admin_demo');
  });

  it('saves a structural template (email_header/email_footer) whose editor never renders CC/BCC/enabled fields at all', async () => {
    // Regression test: a structural template's form (template-editor-page.tsx) omits the
    // ccEmails/bccEmails inputs entirely (only a hidden `enabled=true` is always present) —
    // formData.get() then returns null, not undefined, for the omitted ones, which previously
    // failed zod's `.optional()` (which only accepts undefined) with "Expected string, received
    // null".
    const data = formData({
      key: 'email_footer',
      subject: '(shared footer — not an independent email)',
      body: '<div style="background:#000">Custom footer</div>',
      bodyMode: 'code',
      enabled: 'true'
    });

    const result = await updateTemplateAction(null, data);

    expect(result.ok).toBe(true);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'email_footer', ccEmails: null, bccEmails: null, enabled: true }),
      'usr_admin_demo'
    );
  });

  it('saves a footer background color', async () => {
    const result = await updateTemplateAction(
      null,
      formData({
        key: 'email_footer',
        subject: '(shared footer — not an independent email)',
        body: '<p>Footer</p>',
        bodyMode: 'text',
        enabled: 'true',
        backgroundColor: '#123abc'
      })
    );

    expect(result.ok).toBe(true);
    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({ backgroundColor: '#123abc' }), 'usr_admin_demo');
  });

  it('rejects a background color that is not a #rrggbb hex value', async () => {
    const result = await updateTemplateAction(
      null,
      formData({
        key: 'email_footer',
        subject: '(shared footer — not an independent email)',
        body: '<p>Footer</p>',
        bodyMode: 'text',
        enabled: 'true',
        backgroundColor: 'not-a-color'
      })
    );

    expect(result.ok).toBe(false);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it('rejects an unknown template key', async () => {
    const result = await updateTemplateAction(
      null,
      formData({ key: 'not_a_real_key', subject: 'Subject', body: '<p>Body</p>', bodyMode: 'text' })
    );

    expect(result.ok).toBe(false);
    expect(upsertMock).not.toHaveBeenCalled();
  });
});
