'use client';

import type { ReactNode } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Alert } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import type { SettingsActionResult } from '../types-action';

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Saving…' : 'Save changes'}
    </Button>
  );
}

export interface SettingsSectionFormProps {
  action: (prevState: SettingsActionResult | null, formData: FormData) => Promise<SettingsActionResult>;
  children: ReactNode;
}

/**
 * Shared shell for every settings tab's form — each tab is otherwise
 * independent (its own schema, its own server action, its own section of the
 * settings object), but they all need the same useFormState wiring plus a
 * save button and a saved/error banner, so that plumbing lives here once
 * instead of copied into all seven tabs.
 */
export function SettingsSectionForm({ action, children }: SettingsSectionFormProps) {
  const [state, formAction] = useFormState(action, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {children}
      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="success">Saved.</Alert> : null}
      <div className="flex justify-end">
        <SaveButton />
      </div>
    </form>
  );
}
