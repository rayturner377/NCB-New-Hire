import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card } from '../ui/card';
import { cn } from '../../lib/utils';

export interface StatCardProps {
  label: string;
  value: ReactNode;
  /** Small caption under the value — e.g. "Snapshot as of Sep 2, 2026" or a date-range label for period metrics. */
  description?: string;
  href?: string;
  icon?: LucideIcon;
}

/**
 * Shared metric tile used across every role dashboard (doctor/patient/
 * reviewer/admin) — ported from server.js's dashboardMetric/doctorStatCard
 * (public/app.js ~L1691, ~L2272), now a single reusable component instead of
 * four near-identical inline renderers.
 */
export function StatCard({ label, value, description, href, icon: Icon }: StatCardProps) {
  const content = (
    <Card className={cn('h-24 px-3 py-2.5', href && 'transition-colors hover:bg-accent hover:text-accent-foreground')}>
      <div className="flex h-full flex-col justify-center gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          {Icon ? (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon className="h-[15px] w-[15px]" aria-hidden="true" />
            </span>
          ) : null}
        </div>
        <div>
          <div className="text-xl font-bold leading-none">{value}</div>
          {description ? <p className="mt-1 text-xs font-medium text-muted-foreground">{description}</p> : null}
        </div>
      </div>
    </Card>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}
