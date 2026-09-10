'use client';

import { updateMailSettingsAction } from '../actions/update-settings';
import type { AppSettings } from '../types';
import { Checkbox } from '../../../components/ui/checkbox';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { SettingsSectionForm } from './settings-section-form';
import { SendTestEmailButton } from './send-test-email-button';

export interface MailSettingsFormProps {
  settings: AppSettings['mail'];
}

export function MailSettingsForm({ settings }: MailSettingsFormProps) {
  return (
    <div className="flex flex-col gap-4">
      <SettingsSectionForm action={updateMailSettingsAction}>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="enabled" defaultChecked={settings.enabled} />
          Use these SMTP settings to send notification emails
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fromEmail">From email</Label>
            <Input id="fromEmail" name="fromEmail" type="email" defaultValue={settings.fromEmail} placeholder="no-reply@ncb.com" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="host">SMTP host</Label>
            <Input id="host" name="host" defaultValue={settings.host} placeholder="smtp.office365.com" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="port">SMTP port</Label>
            <Input id="port" name="port" type="number" min={1} max={65535} defaultValue={settings.port} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="username">SMTP username</Label>
            <Input id="username" name="username" defaultValue={settings.username} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">SMTP password</Label>
            <Input id="password" name="password" type="password" placeholder={settings.password ? '••••••••  (leave blank to keep)' : ''} />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <Checkbox name="secure" defaultChecked={settings.secure} />
          Use SMTPS (implicit TLS)
        </label>
      </SettingsSectionForm>

      <SendTestEmailButton defaultRecipient={settings.fromEmail} />
    </div>
  );
}
