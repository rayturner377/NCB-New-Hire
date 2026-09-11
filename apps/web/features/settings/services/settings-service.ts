import { auditRepository, settingsRepository } from '@ncb/database';
import { loadMasterKey } from '../../../lib/master-key';
import { type AppSettings, mergeWithDefaults, publicSettings } from '../types';

/** Full settings object, defaults filled in for anything never saved yet. Admin-only callers (the settings page itself) — see getPublicSettings for the login/branding-safe subset. */
export async function getSettings(): Promise<AppSettings> {
  const masterKey = loadMasterKey();
  const stored = await settingsRepository.read<Partial<AppSettings>>(masterKey);
  return mergeWithDefaults(stored);
}

/** Branding/theme only — safe to call with no session, since the login screen and every other unauthenticated page still need to render the org's logo and theme. */
export async function getPublicSettings() {
  const settings = await getSettings();
  return publicSettings(settings);
}

/**
 * Replaces one top-level section of the settings object and re-saves the
 * whole envelope (settingsRepository stores it as a single encrypted row —
 * see that file's comment on why there's no per-field write). Each settings
 * tab's server action calls this with its own section key, so a save on one
 * tab can never clobber another tab's already-saved values.
 */
export async function updateSettingsSection<K extends keyof AppSettings>(
  section: K,
  patch: AppSettings[K],
  actorId: string
): Promise<AppSettings> {
  const masterKey = loadMasterKey();
  const current = await getSettings();
  const updated: AppSettings = { ...current, [section]: patch };
  await settingsRepository.write(updated, masterKey, actorId);
  await auditRepository.append({
    eventType: 'settings_updated',
    actorUserId: actorId,
    entityType: 'settings',
    entityId: section,
    details: { section }
  });
  return updated;
}
