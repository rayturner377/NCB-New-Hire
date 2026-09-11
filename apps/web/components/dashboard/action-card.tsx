import Link from 'next/link';
import { cn } from '../../lib/utils';

export interface ActionCardProps {
  title: string;
  value: number;
  description?: string;
  href: string;
  /** Visual emphasis — 'warning' for things needing review, 'info' for billing/other call-outs. */
  tone?: 'warning' | 'info';
}

const TONE_CLASSES: Record<NonNullable<ActionCardProps['tone']>, string> = {
  warning: 'border-amber-500/30 bg-amber-500/10',
  info: 'border-sky-500/30 bg-sky-500/10'
};

/**
 * "Needs attention" call-to-action tile — ported from server.js's
 * hrDashboardActionCard (public/app.js ~L2253-2261). Distinct from StatCard:
 * this is a prompt to act (disabled when there's nothing to do), not a
 * passive metric.
 */
export function ActionCard({ title, value, description, href, tone = 'warning' }: ActionCardProps) {
  const hasItems = value > 0;

  const content = (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-lg border p-4 transition-colors',
        hasItems ? TONE_CLASSES[tone] : 'border-border bg-muted/50 text-muted-foreground',
        hasItems && 'hover:bg-opacity-80'
      )}
    >
      <span className="text-sm font-medium">{title}</span>
      <strong className="text-2xl font-semibold">{value}</strong>
      {description ? <span className="text-xs">{description}</span> : null}
    </div>
  );

  if (!hasItems) {
    return content;
  }

  return (
    <Link href={href} className="block">
      {content}
    </Link>
  );
}
