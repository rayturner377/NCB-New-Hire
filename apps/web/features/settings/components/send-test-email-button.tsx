'use client';

import { useFormStatus } from 'react-dom';
import { sendTestEmailAction } from '../actions/send-test-email';
import { Alert } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { NOTIFICATION_TEMPLATES } from '../../notifications/registry';
import { useActionState } from 'react';

/** Only the real sendable notification types — email_header/email_footer are shared wrapper pieces with no subject/variables of their own, not something you'd pick to "send a test of". */
const TESTABLE_TEMPLATES = NOTIFICATION_TEMPLATES.filter((template) => !template.isStructural);

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" size="sm" disabled={pending}>
      {pending ? 'Sending…' : 'Send test email'}
    </Button>
  );
}

export interface SendTestEmailButtonProps {
  defaultRecipient: string;
}

/** Separate `<form>` from the main Mail settings form — sending a test uses whatever's already saved (see send-test-email.ts), not this page's currently-unsaved field values, so mixing the two forms would be misleading. */
export function SendTestEmailButton({ defaultRecipient }: SendTestEmailButtonProps) {
  const [state, formAction] = useActionState(sendTestEmailAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-md border p-3">
      <Label htmlFor="testRecipient">Send a test email</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Input id="testRecipient" name="testRecipient" type="email" defaultValue={defaultRecipient} placeholder="you@ncb.com" className="sm:w-64" />
        <select id="templateKey" name="templateKey" defaultValue="" className="h-9 rounded-md border bg-background px-2 text-sm sm:w-64">
          <option value="">Generic test message</option>
          {TESTABLE_TEMPLATES.map((template) => (
            <option key={template.key} value={template.key}>
              {template.label}
            </option>
          ))}
        </select>
        <SendButton />
      </div>
      <p className="text-xs text-muted-foreground">
        Uses whatever SMTP settings are currently saved — save this tab first if you just changed them. Picking a notification type
        sends its actual current template (header/footer included) with sample data in place of {'{{variables}}'}, so you can see
        exactly what a recipient would get.
      </p>
      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="success">Test email sent.</Alert> : null}
    </form>
  );
}
