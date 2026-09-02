import type { ReactNode } from 'react';

export type AlertTone = 'error' | 'success' | 'info';

export interface AlertProps {
  tone: AlertTone;
  children: ReactNode;
}

export function Alert({ tone, children }: AlertProps) {
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={`ui-alert ui-alert-${tone}`}>
      {children}
    </p>
  );
}
