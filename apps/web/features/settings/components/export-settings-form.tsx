'use client';

import { updateExportSettingsAction } from '../actions/update-settings';
import type { AppSettings } from '../types';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { SettingsSectionForm } from './settings-section-form';

const TEXTAREA_CLASS =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

export interface ExportSettingsFormProps {
  settings: AppSettings['export'];
}

export function ExportSettingsForm({ settings }: ExportSettingsFormProps) {
  return (
    <SettingsSectionForm action={updateExportSettingsAction}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fileNamePattern">Exported file name pattern</Label>
        <Input id="fileNamePattern" name="fileNamePattern" defaultValue={settings.fileNamePattern} required />
        <p className="text-xs text-muted-foreground">Must include {'{caseId}'} so every exported file stays unique.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confidentialityNotice">Confidentiality notice</Label>
        <textarea
          id="confidentialityNotice"
          name="confidentialityNotice"
          rows={3}
          maxLength={2000}
          defaultValue={settings.confidentialityNotice}
          className={TEXTAREA_CLASS}
        />
        <p className="text-xs text-muted-foreground">Shown alongside a case's export controls on the Documents tab.</p>
      </div>
    </SettingsSectionForm>
  );
}
