import { Check, Cloud, LoaderCircle, TriangleAlert } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { AutosaveStatus } from '../../lib/hooks/use-autosave';

export interface AutosaveIndicatorProps {
  status: AutosaveStatus;
  className?: string;
}

const CONFIG: Record<AutosaveStatus, { label: string; icon: typeof Check; className: string }> = {
  idle: { label: 'No changes yet', icon: Cloud, className: 'text-muted-foreground' },
  dirty: { label: 'Unsaved changes', icon: Cloud, className: 'text-muted-foreground' },
  saving: { label: 'Saving…', icon: LoaderCircle, className: 'text-muted-foreground' },
  saved: { label: 'All changes saved', icon: Check, className: 'text-emerald-600 dark:text-emerald-400' },
  error: { label: "Couldn't save — will retry", icon: TriangleAlert, className: 'text-destructive' }
};

/** A Google-Docs-style save-status line — pair with lib/hooks/use-autosave.ts. */
export function AutosaveIndicator({ status, className }: AutosaveIndicatorProps) {
  const { label, icon: Icon, className: toneClassName } = CONFIG[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs', toneClassName, className)}>
      <Icon className={cn('h-3.5 w-3.5', status === 'saving' && 'animate-spin')} aria-hidden="true" />
      {label}
    </span>
  );
}
