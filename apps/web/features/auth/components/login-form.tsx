'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { login, type LoginResult } from '../actions/login';

const initialState: LoginResult | null = null;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Signing in…' : 'Sign in'}
    </button>
  );
}

export function LoginForm() {
  const [state, formAction] = useFormState(login, initialState);

  return (
    <form action={formAction} className="login-form">
      <label htmlFor="email">Email</label>
      <input id="email" name="email" type="email" autoComplete="email" required />

      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required />

      {state?.error ? (
        <p role="alert" className="login-form-error">
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
