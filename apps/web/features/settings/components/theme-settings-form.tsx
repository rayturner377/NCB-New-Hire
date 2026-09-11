'use client';

import { updateThemeSettingsAction } from '../actions/update-settings';
import type { AppSettings } from '../types';
import { SelectField } from '../../../components/form/select-field';
import { Label } from '../../../components/ui/label';
import { SettingsSectionForm } from './settings-section-form';

export interface ThemeSettingsFormProps {
  settings: AppSettings['theme'];
}

function ColorField({ name, label, defaultValue }: { name: string; label: string; defaultValue: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3">
      <Label htmlFor={name}>{label}</Label>
      <input id={name} name={name} type="color" defaultValue={defaultValue} className="h-9 w-16 cursor-pointer rounded border" />
    </div>
  );
}

export function ThemeSettingsForm({ settings }: ThemeSettingsFormProps) {
  return (
    <SettingsSectionForm action={updateThemeSettingsAction}>
      <div className="flex flex-col gap-1.5">
        <SelectField
          name="mode"
          label="Default appearance"
          defaultValue={settings.mode}
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' }
          ]}
          className="w-48"
        />
        <p className="text-xs text-muted-foreground">
          The portal-wide default (including the login screen) — anyone can still switch their own view from the sidebar
          without changing this.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ColorField name="primaryColor" label="Buttons & links" defaultValue={settings.primaryColor} />
        <ColorField name="accentColor" label="Accents & selections" defaultValue={settings.accentColor} />
        <ColorField name="dangerColor" label="Warnings & errors" defaultValue={settings.dangerColor} />
      </div>
    </SettingsSectionForm>
  );
}
