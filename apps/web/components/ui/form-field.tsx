import type { ReactNode } from 'react';
import { Alert } from './alert';

export interface FormFieldProps {
  label: string;
  name: string;
  error?: string;
  /** The actual <input>/<select>/<textarea>, kept unopinionated about input type. */
  children: ReactNode;
}

export function FormField({ label, name, error, children }: FormFieldProps) {
  return (
    <div className="ui-form-field">
      <label htmlFor={name}>{label}</label>
      {children}
      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  );
}
