import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export type AlertTone = 'error' | 'success' | 'info';

export interface AlertProps {
  tone: AlertTone;
  children: ReactNode;
}

const TONE_CLASSES: Record<AlertTone, string> = {
  error: 'border-destructive/30 bg-destructive/10 text-destructive',
  success: 'border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400',
  info: 'border-border bg-muted text-muted-foreground'
};

export function Alert({ tone, children }: AlertProps) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('rounded-md border px-3 py-2 text-sm', TONE_CLASSES[tone])}
    >
      {children}
    </p>
  );
}
