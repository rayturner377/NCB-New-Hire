'use client';

import { updateNotificationSettingsAction } from '../actions/update-settings';
import type { AppSettings } from '../types';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { SettingsSectionForm } from './settings-section-form';

export interface NotificationSettingsFormProps {
  settings: AppSettings['notifications'];
  mailEnabled: boolean;
}

export function NotificationSettingsForm({ settings, mailEnabled }: NotificationSettingsFormProps) {
  return (
    <SettingsSectionForm action={updateNotificationSettingsAction}>
      {!mailEnabled ? (
        <p className="rounded-md border bg-muted px-3 py-2 text-xs text-muted-foreground">
          These only take effect once SMTP is enabled under the Mail tab — until then they're saved but nothing actually sends.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reviewerNotificationEmail">Reviewer notification email(s)</Label>
          <Input
            id="reviewerNotificationEmail"
            name="reviewerNotificationEmail"
            defaultValue={settings.reviewerNotificationEmail}
            placeholder="hr-team@ncb.com"
          />
          <p className="text-xs text-muted-foreground">Where a case-ready-for-review notification goes — there's no single "assigned reviewer" on a case.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="doctorNotificationEmail">Doctor notification copy email(s)</Label>
          <Input
            id="doctorNotificationEmail"
            name="doctorNotificationEmail"
            defaultValue={settings.doctorNotificationEmail}
            placeholder="doctors-admin@ncb.com"
          />
          <p className="text-xs text-muted-foreground">CC'd on every doctor-directed email, alongside the actual assigned doctor.</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        What each notification says, and whether it's turned on at all, is now managed per notification type under the Templates tab.
      </p>
    </SettingsSectionForm>
  );
}
