'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Alert } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { PasswordInput } from '../../../components/ui/password-input';
import { login, type LoginResult } from '../actions/login';

const initialState: LoginResult | null = null;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Signing in…' : 'Sign in'}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useFormState(login, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <PasswordInput id="password" name="password" autoComplete="current-password" required />
      </div>

      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}

      <SubmitButton />
    </form>
  );
}
