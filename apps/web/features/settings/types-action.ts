export interface SettingsActionResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export const SETTINGS_ACTION_IDLE: SettingsActionResult = { ok: false };
