import { beforeEach, describe, expect, it, vi } from 'vitest';

const listMock = vi.fn();
const findByKeyMock = vi.fn();

vi.mock('@ncb/database', () => ({
  notificationTemplatesRepository: {
    list: (...args: unknown[]) => listMock(...args),
    findByKey: (...args: unknown[]) => findByKeyMock(...args)
  }
}));

const { listTemplateViews, listStructuralTemplateViews, getTemplateView } = await import('../../services/templates-service');

describe('templates-service', () => {
  beforeEach(() => {
    listMock.mockReset();
    findByKeyMock.mockReset();
    listMock.mockResolvedValue([]);
    findByKeyMock.mockResolvedValue(null);
  });

  it('listTemplateViews excludes the shared header/footer, returning only real sendable notification types', async () => {
    const views = await listTemplateViews();
    const keys = views.map((view) => view.key);

    expect(keys).toContain('case_reviewed');
    expect(keys).not.toContain('email_header');
    expect(keys).not.toContain('email_footer');
    expect(views.every((view) => view.isStructural === false)).toBe(true);
  });

  it('listStructuralTemplateViews returns exactly the shared header/footer, and only those', async () => {
    const views = await listStructuralTemplateViews();
    const keys = views.map((view) => view.key).sort();

    expect(keys).toEqual(['email_footer', 'email_header']);
    expect(views.every((view) => view.isStructural === true)).toBe(true);
  });

  it('getTemplateView works for a structural key the same way it does for a real notification type', async () => {
    const view = await getTemplateView('email_footer');

    expect(view?.key).toBe('email_footer');
    expect(view?.isStructural).toBe(true);
    expect(view?.body).toContain('organizationName');
  });

  it('getTemplateView merges a saved override in for a structural template just like a real one', async () => {
    findByKeyMock.mockResolvedValue({ subject: '', body: '<p>Custom footer</p>', bodyMode: 'code', ccEmails: null, bccEmails: null, enabled: true });

    const view = await getTemplateView('email_header');

    expect(view?.body).toBe('<p>Custom footer</p>');
    expect(view?.bodyMode).toBe('code');
  });

  it('getTemplateView returns null for an unknown key', async () => {
    expect(await getTemplateView('not_a_real_key')).toBeNull();
  });

  it('getTemplateView falls back to the registry default background color for email_footer until an admin saves their own', async () => {
    const view = await getTemplateView('email_footer');
    expect(view?.backgroundColor).toBe('#005baa');
  });

  it('getTemplateView prefers a saved background color over the registry default', async () => {
    findByKeyMock.mockResolvedValue({
      subject: '',
      body: '<p>Custom footer</p>',
      bodyMode: 'text',
      ccEmails: null,
      bccEmails: null,
      backgroundColor: '#123456',
      enabled: true
    });

    const view = await getTemplateView('email_footer');
    expect(view?.backgroundColor).toBe('#123456');
  });
});
