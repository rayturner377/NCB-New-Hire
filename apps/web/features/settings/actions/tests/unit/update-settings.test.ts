import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SLA_EVENT_KEYS, isValidEventOrder } from '../../../sla-events';

const getSessionMock = vi.fn();
const getSettingsMock = vi.fn();
const updateSettingsSectionMock = vi.fn();
const revalidatePathMock = vi.fn();
const setDeviceVerificationRequiredForAllMock = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePathMock(...args) }));
vi.mock('../../../../../lib/assert-same-origin', () => ({ assertSameOrigin: async () => undefined }));
vi.mock('../../../../../lib/session', () => ({ getSession: (...args: unknown[]) => getSessionMock(...args), requireFullSession: (...args: unknown[]) => getSessionMock(...args) }));
vi.mock('../../../services/settings-service', () => ({
  getSettings: (...args: unknown[]) => getSettingsMock(...args),
  updateSettingsSection: (...args: unknown[]) => updateSettingsSectionMock(...args)
}));
vi.mock('../../../../users/services/users-service', () => ({
  setDeviceVerificationRequiredForAll: (...args: unknown[]) => setDeviceVerificationRequiredForAllMock(...args)
}));

const {
  updateGeneralSettingsAction,
  updateNotificationSettingsAction,
  updateExportSettingsAction,
  updateUserPolicySettingsAction,
  updateSlaSettingsAction,
  updateThemeSettingsAction,
  updateMailSettingsAction
} = await import('../../update-settings');

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const adminSession = { user: { id: 'usr_admin', role: 'admin' } };

// Find a real, validly-ordered start/end pair from the actual SLA event
// registry rather than hardcoding two keys that might not satisfy
// isValidEventOrder as the registry evolves.
function validSlaEventPair(): [string, string] {
  for (const start of SLA_EVENT_KEYS) {
    for (const end of SLA_EVENT_KEYS) {
      if (isValidEventOrder(start, end)) return [start, end];
    }
  }
  throw new Error('No valid SLA event pair found in the registry — test needs updating.');
}

describe('settings actions', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    getSettingsMock.mockReset();
    updateSettingsSectionMock.mockReset();
    revalidatePathMock.mockClear();
    setDeviceVerificationRequiredForAllMock.mockReset();
    getSessionMock.mockResolvedValue(adminSession);
    getSettingsMock.mockResolvedValue({ userPolicy: { requireDeviceVerification: true } });
  });

  describe('shared access control (checked once, applies to every action below)', () => {
    it('rejects without an active session', async () => {
      getSessionMock.mockResolvedValue(null);

      const result = await updateGeneralSettingsAction(null, formData({ organizationName: 'NCB', portalName: 'Portal' }));

      expect(result.ok).toBe(false);
      expect(updateSettingsSectionMock).not.toHaveBeenCalled();
    });

    it("rejects when the caller's role lacks SETTINGS_MANAGE", async () => {
      getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role: 'reviewer' } });

      const result = await updateGeneralSettingsAction(null, formData({ organizationName: 'NCB', portalName: 'Portal' }));

      expect(result.ok).toBe(false);
      expect(updateSettingsSectionMock).not.toHaveBeenCalled();
    });
  });

  describe('updateGeneralSettingsAction', () => {
    it('rejects a missing organization name as a field error', async () => {
      const result = await updateGeneralSettingsAction(null, formData({ portalName: 'Portal' }));

      expect(result.ok).toBe(false);
      expect(result.fieldErrors?.organizationName).toBeTruthy();
    });

    it('updates general settings and revalidates settings + the root layout', async () => {
      const result = await updateGeneralSettingsAction(null, formData({ organizationName: 'NCB', portalName: 'Portal' }));

      expect(result.ok).toBe(true);
      expect(updateSettingsSectionMock).toHaveBeenCalledWith('general', expect.objectContaining({ organizationName: 'NCB' }), 'usr_admin');
      expect(revalidatePathMock).toHaveBeenCalledWith('/settings');
      expect(revalidatePathMock).toHaveBeenCalledWith('/', 'layout');
    });
  });

  describe('updateNotificationSettingsAction', () => {
    it('rejects without access', async () => {
      getSessionMock.mockResolvedValue(null);
      const result = await updateNotificationSettingsAction(null, formData({}));
      expect(result.ok).toBe(false);
    });

    it('accepts both notification emails left blank (still present as empty strings, as a real form submits them)', async () => {
      const result = await updateNotificationSettingsAction(
        null,
        formData({ reviewerNotificationEmail: '', doctorNotificationEmail: '' })
      );

      expect(result.ok).toBe(true);
      expect(updateSettingsSectionMock).toHaveBeenCalledWith('notifications', expect.any(Object), 'usr_admin');
    });
  });

  describe('updateExportSettingsAction', () => {
    it('rejects without access', async () => {
      getSessionMock.mockResolvedValue(null);
      const result = await updateExportSettingsAction(null, formData({}));
      expect(result.ok).toBe(false);
    });

    it('rejects a file name pattern missing the required {caseId} placeholder', async () => {
      const result = await updateExportSettingsAction(null, formData({ fileNamePattern: 'export.pdf' }));

      expect(result.ok).toBe(false);
    });

    it('accepts a valid pattern', async () => {
      const result = await updateExportSettingsAction(null, formData({ fileNamePattern: 'case-{caseId}.pdf' }));

      expect(result.ok).toBe(true);
    });
  });

  describe('updateUserPolicySettingsAction', () => {
    it('rejects without access', async () => {
      getSessionMock.mockResolvedValue(null);
      const result = await updateUserPolicySettingsAction(null, formData({}));
      expect(result.ok).toBe(false);
    });

    const validPolicy = {
      minPasswordLength: '12',
      sessionTimeoutMinutes: '15',
      loginMaxAttempts: '5',
      loginWindowMinutes: '15'
    };

    it('rejects a minPasswordLength below the floor', async () => {
      const result = await updateUserPolicySettingsAction(null, formData({ ...validPolicy, minPasswordLength: '4' }));

      expect(result.ok).toBe(false);
    });

    it('treats checkbox fields as booleans based on presence, not value', async () => {
      const data = formData({ ...validPolicy, requireUppercase: 'on' });

      const result = await updateUserPolicySettingsAction(null, data);

      expect(result.ok).toBe(true);
      expect(updateSettingsSectionMock).toHaveBeenCalledWith(
        'userPolicy',
        expect.objectContaining({ requireUppercase: true, requireNumber: false }),
        'usr_admin'
      );
    });

    it('does not bulk-update AppUser.twoFactorEnabled when requireDeviceVerification is unchanged', async () => {
      getSettingsMock.mockResolvedValue({ userPolicy: { requireDeviceVerification: true } });

      const result = await updateUserPolicySettingsAction(null, formData({ ...validPolicy, requireDeviceVerification: 'on' }));

      expect(result.ok).toBe(true);
      expect(setDeviceVerificationRequiredForAllMock).not.toHaveBeenCalled();
    });

    it('bulk-disables AppUser.twoFactorEnabled for every account when the toggle is flipped off', async () => {
      getSettingsMock.mockResolvedValue({ userPolicy: { requireDeviceVerification: true } });

      const result = await updateUserPolicySettingsAction(null, formData({ ...validPolicy }));

      expect(result.ok).toBe(true);
      expect(setDeviceVerificationRequiredForAllMock).toHaveBeenCalledWith(false, 'usr_admin');
    });

    it('bulk-re-enables AppUser.twoFactorEnabled for every account when the toggle is flipped back on', async () => {
      getSettingsMock.mockResolvedValue({ userPolicy: { requireDeviceVerification: false } });

      const result = await updateUserPolicySettingsAction(null, formData({ ...validPolicy, requireDeviceVerification: 'on' }));

      expect(result.ok).toBe(true);
      expect(setDeviceVerificationRequiredForAllMock).toHaveBeenCalledWith(true, 'usr_admin');
    });
  });

  describe('updateSlaSettingsAction', () => {
    it('rejects without access', async () => {
      getSessionMock.mockResolvedValue(null);
      const result = await updateSlaSettingsAction(null, formData({}));
      expect(result.ok).toBe(false);
    });

    it('rejects unparseable JSON in definitionsJson', async () => {
      const result = await updateSlaSettingsAction(null, formData({ definitionsJson: '{not json' }));

      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/could not read/i);
    });

    it('rejects a definitions array failing schema validation (e.g. bad event order)', async () => {
      const [start, end] = validSlaEventPair();
      const definitions = [
        {
          key: 'bad_order',
          name: 'Bad order',
          startEvent: end,
          endEvent: start,
          targetHours: 24,
          warningPercent: 80
        }
      ];

      const result = await updateSlaSettingsAction(null, formData({ definitionsJson: JSON.stringify(definitions) }));

      expect(result.ok).toBe(false);
    });

    it('accepts a valid definitions array and revalidates settings + cases', async () => {
      const [startEvent, endEvent] = validSlaEventPair();
      const definitions = [{ key: 'valid_sla', name: 'Valid SLA', startEvent, endEvent, targetHours: 24, warningPercent: 80 }];

      const result = await updateSlaSettingsAction(null, formData({ definitionsJson: JSON.stringify(definitions) }));

      expect(result.ok).toBe(true);
      expect(revalidatePathMock).toHaveBeenCalledWith('/settings');
      expect(revalidatePathMock).toHaveBeenCalledWith('/cases');
    });
  });

  describe('updateThemeSettingsAction', () => {
    it('rejects without access', async () => {
      getSessionMock.mockResolvedValue(null);
      const result = await updateThemeSettingsAction(null, formData({}));
      expect(result.ok).toBe(false);
    });

    it('rejects a non-hex color', async () => {
      const result = await updateThemeSettingsAction(
        null,
        formData({ mode: 'light', primaryColor: 'blue', accentColor: '#ffffff', dangerColor: '#ff0000' })
      );

      expect(result.ok).toBe(false);
    });

    it('accepts valid hex colors and revalidates the root layout', async () => {
      const result = await updateThemeSettingsAction(
        null,
        formData({ mode: 'dark', primaryColor: '#123456', accentColor: '#abcdef', dangerColor: '#ff0000' })
      );

      expect(result.ok).toBe(true);
      expect(revalidatePathMock).toHaveBeenCalledWith('/', 'layout');
    });
  });

  describe('updateMailSettingsAction', () => {
    it('rejects without access', async () => {
      getSessionMock.mockResolvedValue(null);
      const result = await updateMailSettingsAction(null, formData({}));
      expect(result.ok).toBe(false);
    });

    it('rejects an invalid fromEmail', async () => {
      const result = await updateMailSettingsAction(null, formData({ fromEmail: 'not-an-email' }));

      expect(result.ok).toBe(false);
    });

    it('preserves the existing saved password when the field is submitted blank', async () => {
      getSettingsMock.mockResolvedValue({ mail: { password: 'existing-secret' } });

      const result = await updateMailSettingsAction(
        null,
        formData({ fromEmail: 'noreply@ncb.local', host: 'smtp.ncb.local', port: '587', username: '', password: '' })
      );

      expect(result.ok).toBe(true);
      expect(updateSettingsSectionMock).toHaveBeenCalledWith('mail', expect.objectContaining({ password: 'existing-secret' }), 'usr_admin');
    });

    it('uses the newly submitted password when one is actually provided', async () => {
      const result = await updateMailSettingsAction(
        null,
        formData({ fromEmail: 'noreply@ncb.local', host: 'smtp.ncb.local', port: '587', username: '', password: 'new-secret' })
      );

      expect(result.ok).toBe(true);
      expect(getSettingsMock).not.toHaveBeenCalled();
      expect(updateSettingsSectionMock).toHaveBeenCalledWith('mail', expect.objectContaining({ password: 'new-secret' }), 'usr_admin');
    });
  });
});
