'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DateRangeInputs } from '../../../components/dashboard/date-range-inputs';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { useDebouncedFilterNavigation } from '../../../lib/hooks/use-debounced-filter-navigation';

export interface HrTurnaroundReportFiltersProps {
  query: string;
  from: string;
  to: string;
  hasActiveFilters: boolean;
}

function buildHref(values: { query: string; from: string; to: string }): string {
  const params = new URLSearchParams();
  if (values.query) params.set('query', values.query);
  if (values.from) params.set('from', values.from);
  if (values.to) params.set('to', values.to);
  const search = params.toString();
  return search ? `/reports/hr-turnaround?${search}` : '/reports/hr-turnaround';
}

/** Same auto-applies-on-change pattern as billing-report-filters.tsx, minus the billing-status dropdown (not relevant to a review-turnaround report). */
export function HrTurnaroundReportFilters({ query: initialQuery, from, to, hasActiveFilters }: HrTurnaroundReportFiltersProps) {
  const { navigate, navigateDebounced } = useDebouncedFilterNavigation();
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => setQuery(initialQuery), [initialQuery]);

  function navigateTo(next: Partial<{ query: string; from: string; to: string }>) {
    navigate(buildHref({ query, from, to, ...next }));
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    navigateDebounced(buildHref({ query: value, from, to }));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end gap-2">
        <DateRangeInputs from={from} to={to} onFromChange={(value) => navigateTo({ from: value })} onToChange={(value) => navigateTo({ to: value })} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={query}
          onChange={(event) => handleQueryChange(event.target.value)}
          placeholder="Search by candidate name…"
          className="h-9 sm:max-w-xs"
        />

        {hasActiveFilters ? (
          <Button type="button" variant="ghost" className="h-9" asChild>
            <Link href="/reports/hr-turnaround" prefetch={false}>
              Clear
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
