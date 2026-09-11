'use client';

import { Progress } from '../ui/progress';
import { cn } from '../../lib/utils';

export interface FormProgressSection {
  key: string;
  label: string;
  complete: boolean;
}

export interface FormProgressProps {
  sections: FormProgressSection[];
  className?: string;
}

/**
 * A reusable "how much of this form is done" indicator — an overall
 * percentage bar (shadcn's Progress, a thin wrapper over
 * @radix-ui/react-progress) plus an "X/Y complete" count. Per-section detail
 * lives on the tabs themselves (see patient-case-form.tsx's checkmarked
 * TabsTrigger labels), so this stays a plain summary rather than repeating
 * each section's name a second time.
 */
export function FormProgress({ sections, className }: FormProgressProps) {
  const completeCount = sections.filter((section) => section.complete).length;
  const percent = sections.length ? Math.round((completeCount / sections.length) * 100) : 0;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Progress value={percent} className="h-1 flex-1" />
      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/80">
        {completeCount}/{sections.length} complete
      </span>
    </div>
  );
}
