'use client';

import { updateGeneralSettingsAction } from '../actions/update-settings';
import type { AppSettings } from '../types';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { LogoUploadField } from './logo-upload-field';
import { SettingsSectionForm } from './settings-section-form';

export interface GeneralSettingsFormProps {
  settings: AppSettings['general'];
}

export function GeneralSettingsForm({ settings }: GeneralSettingsFormProps) {
  return (
    <SettingsSectionForm action={updateGeneralSettingsAction}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="organizationName">Organization name</Label>
          <Input id="organizationName" name="organizationName" defaultValue={settings.organizationName} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="portalName">Portal name</Label>
          <Input id="portalName" name="portalName" defaultValue={settings.portalName} required />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="supportContact">Support contact</Label>
          <Input id="supportContact" name="supportContact" defaultValue={settings.supportContact} placeholder="e.g. hrsupport@ncb.com" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <LogoUploadField
          name="smallLogoDataUrl"
          label="Small logo (topbar)"
          hint="Shown in the sidebar topbar — a square mark works best."
          defaultValue={settings.smallLogoDataUrl}
        />
        <LogoUploadField
          name="largeLogoDataUrl"
          label="Large logo (login screen)"
          hint="Shown above the sign-in form."
          defaultValue={settings.largeLogoDataUrl}
        />
        <LogoUploadField
          name="loginImageDataUrl"
          label="Login screen image (right side)"
          hint="Fills the right-hand panel next to the sign-in form. Uploading a new one replaces this."
          defaultValue={settings.loginImageDataUrl}
        />
      </div>
    </SettingsSectionForm>
  );
}
