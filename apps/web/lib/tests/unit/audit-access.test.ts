import { beforeEach, describe, expect, it, vi } from 'vitest';

const appendMock = vi.fn();
const getClientIpMock = vi.fn();

vi.mock('@ncb/database', () => ({ auditRepository: { append: (...args: unknown[]) => appendMock(...args) } }));
vi.mock('../../client-ip', () => ({ getClientIp: (...args: unknown[]) => getClientIpMock(...args) }));

const { logAccessDenied } = await import('../../audit-access');

describe('logAccessDenied', () => {
  beforeEach(() => {
    appendMock.mockReset();
    getClientIpMock.mockReset();
    getClientIpMock.mockResolvedValue('203.0.113.5');
  });

  it('records an access_denied event with the source IP and requested path', async () => {
    await logAccessDenied({ userId: 'usr_1', role: 'clinician', permission: 'settings:manage', path: '/settings' });

    expect(appendMock).toHaveBeenCalledWith({
      eventType: 'access_denied',
      actorUserId: 'usr_1',
      entityType: 'route',
      entityId: '/settings',
      sourceIp: '203.0.113.5',
      details: { role: 'clinician', permission: 'settings:manage', path: '/settings' }
    });
  });

  it('uses an explicit entityId over the path when given', async () => {
    await logAccessDenied({ userId: 'usr_1', role: 'clinician', permission: 'medical_cases:list', path: '/cases/case_1', entityId: 'case_1' });

    expect(appendMock).toHaveBeenCalledWith(expect.objectContaining({ entityId: 'case_1' }));
  });
});
