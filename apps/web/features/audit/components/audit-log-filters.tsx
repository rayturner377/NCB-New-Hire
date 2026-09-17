'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EVENT_TYPE_GROUPS, eventLabel } from '../../../lib/audit-event-labels';
import { DateRangeInputs } from '../../../components/dashboard/date-range-inputs';
import { Button } from '../../../components/ui/button';
import { MultiSelectPopover, type MultiSelectGroup } from '../../../components/ui/multi-select';

export interface AuditLogFiltersProps {
  eventTypes: string[];
  from: string;
  to: string;
  hasActiveFilters: boolean;
}

interface FilterValues {
  eventTypes: string[];
  from: string;
  to: string;
}

const EVENT_TYPE_OPTION_GROUPS: MultiSelectGroup[] = EVENT_TYPE_GROUPS.map((group) => ({
  label: group.label,
  options: group.eventTypes.map((type) => ({ value: type, label: eventLabel(type) }))
}));

/**
 * Same auto-apply-on-change pattern as billing's OrganizationBillingFilters —
 * a checkbox-list MultiSelectPopover (grouped by EVENT_TYPE_GROUPS so "case
 * activity" vs. "user accounts" vs. "sessions & access" reads as a set of
 * categories, not one flat alphabetical dump) so several activity types can
 * be picked at once, plus the shared DateRangeInputs. Selected types are
 * carried in the URL as a comma-separated `type` param — see
 * audit-log-container.tsx's parsing. Page resets to 1 whenever a filter
 * changes — see navigate() dropping `page` entirely.
 */
export function AuditLogFilters({ eventTypes, from, to, hasActiveFilters }: AuditLogFiltersProps) {
  const router = useRouter();

  function navigate(next: Partial<FilterValues>) {
    const merged: FilterValues = { eventTypes, from, to, ...next };
    const params = new URLSearchParams();
    if (merged.eventTypes.length) params.set('type', merged.eventTypes.join(','));
    if (merged.from) params.set('from', merged.from);
    if (merged.to) params.set('to', merged.to);
    const search = params.toString();
    router.push(search ? `/audit?${search}` : '/audit');
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <MultiSelectPopover
        groups={EVENT_TYPE_OPTION_GROUPS}
        selected={eventTypes}
        onChange={(values) => navigate({ eventTypes: values })}
        placeholder="All activity"
        searchPlaceholder="Search activity types…"
        className="h-9 min-w-[13rem]"
      />

      <DateRangeInputs from={from} to={to} onFromChange={(value) => navigate({ from: value })} onToChange={(value) => navigate({ to: value })} />

      {hasActiveFilters ? (
        <Button type="button" variant="ghost" className="h-9" asChild>
          <Link href="/audit" prefetch={false}>
            Clear
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
