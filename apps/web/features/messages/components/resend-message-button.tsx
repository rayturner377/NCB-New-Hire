'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { resendMessageAction } from '../actions/resend-message';
import { Alert } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';

function ResendButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant="secondary" disabled={pending}>
      {pending ? 'Resending…' : 'Resend'}
    </Button>
  );
}

export interface ResendMessageButtonProps {
  id: string;
}

export function ResendMessageButton({ id }: ResendMessageButtonProps) {
  const [state, formAction] = useFormState(resendMessageAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <ResendButton />
      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="success">Resent successfully.</Alert> : null}
    </form>
  );
}
