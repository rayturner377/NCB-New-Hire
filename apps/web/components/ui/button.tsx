import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

/**
 * No "use client" directive — shared presentational primitives stay usable
 * from both Server and Client Components (interactivity, if any, belongs to
 * the caller, e.g. features/auth/components/login-form.tsx's own
 * useFormStatus-based SubmitButton).
 */
export function Button({ variant = 'primary', className, ...props }: ButtonProps) {
  const classes = ['ui-button', `ui-button-${variant}`, className].filter(Boolean).join(' ');
  return <button className={classes} {...props} />;
}
