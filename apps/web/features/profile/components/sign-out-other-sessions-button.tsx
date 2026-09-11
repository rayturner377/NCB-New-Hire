'use client';

import { useFormStatus } from 'react-dom';
import { signOutOtherSessionsAction } from '../../auth/actions/sign-out-other-sessions';
import { Alert } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { useActionState } from 'react';

function SignOutButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      {pending ? 'Signing out other devices…' : 'Sign out of other devices'}
    </Button>
  );
}

/**
 * A self-service response to "I think my account is logged in somewhere I
 * don't recognize" — kills every other active session on this account
 * without needing an admin to step in. The browser this button is clicked
 * from stays signed in (see sign-out-other-sessions.ts's
 * auth.api.revokeOtherSessions() call).
 */
export function SignOutOtherSessionsButton() {
  const [state, formAction] = useActionState(signOutOtherSessionsAction, null);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <SignOutButton />
      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="success">Done — every other device has been signed out. This one stays signed in.</Alert> : null}
    </form>
  );
}
