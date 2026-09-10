import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface FormFieldProps {
  label: string;
  name: string;
  error?: string;
  /** Shows a red asterisk next to the label — purely visual, pair with the input's own `required` attribute for actual enforcement. */
  required?: boolean;
  /** Short helper text shown under the input when there's no error. */
  description?: string;
  className?: string;
  /** The actual <input>/<select>/<textarea>, kept unopinionated about input type. */
  children: ReactNode;
}

/**
 * Kept the `.ui-form-field` class (globals.css) for the vertical spacing
 * every existing form already relies on between fields — only the field's
 * own internals (label styling, error/description) were modernized, so nothing
 * that already renders through FormField shifts layout unexpectedly.
 */
export function FormField({ label, name, error, required, description, className, children }: FormFieldProps) {
  return (
    <div className={cn('ui-form-field', className)}>
      <label htmlFor={name} className="text-sm font-medium leading-none">
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </label>
      <div className={cn(error && '[&_button]:border-destructive [&_input]:border-destructive [&_textarea]:border-destructive')}>
        {children}
      </div>
      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
