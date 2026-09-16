'use client';

import { updateUserPolicySettingsAction } from '../actions/update-settings';
import type { AppSettings } from '../types';
import { Checkbox } from '../../../components/ui/checkbox';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { SettingsSectionForm } from './settings-section-form';

export interface UserPolicySettingsFormProps {
  settings: AppSettings['userPolicy'];
}

export function UserPolicySettingsForm({ settings }: UserPolicySettingsFormProps) {
  return (
    <SettingsSectionForm action={updateUserPolicySettingsAction}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5 sm:w-64">
          <Label htmlFor="minPasswordLength">Minimum password length</Label>
          <Input id="minPasswordLength" name="minPasswordLength" type="number" min={8} max={64} defaultValue={settings.minPasswordLength} required />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="requireUppercase" defaultChecked={settings.requireUppercase} />
          Require at least one uppercase letter
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="requireNumber" defaultChecked={settings.requireNumber} />
          Require at least one number
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="requireSymbol" defaultChecked={settings.requireSymbol} />
          Require at least one symbol
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sessionTimeoutMinutes">Session timeout (minutes)</Label>
          <Input id="sessionTimeoutMinutes" name="sessionTimeoutMinutes" type="number" min={1} max={1440} defaultValue={settings.sessionTimeoutMinutes} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="loginMaxAttempts">Login max attempts</Label>
          <Input id="loginMaxAttempts" name="loginMaxAttempts" type="number" min={1} max={50} defaultValue={settings.loginMaxAttempts} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="loginWindowMinutes">Login window (minutes)</Label>
          <Input id="loginWindowMinutes" name="loginWindowMinutes" type="number" min={1} max={1440} defaultValue={settings.loginWindowMinutes} required />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Password rules apply the next time an account is created or its password is reset. Login max attempts/window take effect on the very
        next login attempt. Session timeout is saved here for reference — wiring it into the live session logic is a follow-up (it would mean
        an extra settings lookup on every authenticated page load).
      </p>

      <div className="flex flex-col gap-1.5 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
        <label className="flex items-center gap-2 text-sm font-medium">
          <Checkbox name="requireDeviceVerification" defaultChecked={settings.requireDeviceVerification} />
          Require email verification for new devices
        </label>
        <p className="text-xs text-muted-foreground">
          When on, signing in from an unrecognized browser requires a code emailed to the account holder before access is granted. Turning
          this off immediately removes that requirement for every account — this is an emergency-only switch for when outbound email is down
          and people are locked out, not a routine setting. Turn it back on as soon as email is working again.
        </p>
      </div>
    </SettingsSectionForm>
  );
}
