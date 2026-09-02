'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Alert } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { FormField } from '../../../components/ui/form-field';
import { login, type LoginResult } from '../actions/login';

const initialState: LoginResult | null = null;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Signing in…' : 'Sign in'}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useFormState(login, initialState);

  return (
    <form action={formAction} className="login-form">
      <FormField label="Email" name="email">
        <input id="email" name="email" type="email" autoComplete="email" required />
      </FormField>

      <FormField label="Password" name="password">
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </FormField>

      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}

      <SubmitButton />
    </form>
  );
}
