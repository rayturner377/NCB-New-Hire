import { Badge } from '../ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { cn } from '../../lib/utils';
import type { SlaStatus } from '../../lib/sla';

const TONE_CLASSES: Record<SlaStatus['tone'], string> = {
  success: 'border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  destructive: 'border-destructive/30 bg-destructive/10 text-destructive'
};

const DOT_CLASSES: Record<SlaStatus['tone'], string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  destructive: 'bg-destructive'
};

export function SlaBadge({ label, tone }: SlaStatus) {
  return (
    <Badge variant="outline" className={cn('font-medium', TONE_CLASSES[tone])}>
      {label}
    </Badge>
  );
}

export interface SlaDotProps extends SlaStatus {
  /** Extra context appended to the tooltip, e.g. "4 days waiting". */
  detail?: string;
}

/**
 * Always-visible colored dot (works with no hover — mobile, touch, screen
 * readers via aria-label) with a tooltip carrying the exact wording for
 * anyone who hovers/focuses it. Used instead of a dedicated SLA column so
 * the status reads at a glance without spending table width on it.
 */
export function SlaDot({ label, tone, detail }: SlaDotProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          role="img"
          aria-label={detail ? `${label} — ${detail}` : label}
          className={cn('inline-block h-2 w-2 shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring', DOT_CLASSES[tone])}
        />
      </TooltipTrigger>
      <TooltipContent>{detail ? `${label} — ${detail}` : label}</TooltipContent>
    </Tooltip>
  );
}
