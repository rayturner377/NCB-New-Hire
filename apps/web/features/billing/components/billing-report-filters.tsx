'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DateRangeInputs } from '../../../components/dashboard/date-range-inputs';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { useDebouncedFilterNavigation } from '../../../lib/hooks/use-debounced-filter-navigation';
import { statusLabel } from '../../../lib/status-labels';
import { BILLING_STATUS_OPTIONS } from '../../cases/billing-status';

export interface BillingReportFiltersProps {
  query: string;
  billing: string;
  from: string;
  to: string;
  hasActiveFilters: boolean;
}

const ALL_BILLING = '__all__';

function buildHref(values: { query: string; billing: string; from: string; to: string }): string {
  const params = new URLSearchParams();
  if (values.query) params.set('query', values.query);
  if (values.billing) params.set('billing', values.billing);
  if (values.from) params.set('from', values.from);
  if (values.to) params.set('to', values.to);
  const search = params.toString();
  return search ? `/billing?${search}` : '/billing';
}

/** Auto-applies on change, same pattern as features/cases/components/cases-filters.tsx — the status dropdown is a shadcn Select (not a bare `<select>`) for the same styling every other dropdown in the app now uses. */
export function BillingReportFilters({ query: initialQuery, billing, from, to, hasActiveFilters }: BillingReportFiltersProps) {
  const { navigate, navigateDebounced } = useDebouncedFilterNavigation();
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => setQuery(initialQuery), [initialQuery]);

  function navigateTo(next: Partial<{ query: string; billing: string; from: string; to: string }>) {
    navigate(buildHref({ query, billing, from, to, ...next }));
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    navigateDebounced(buildHref({ query: value, billing, from, to }));
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

        <Select value={billing || ALL_BILLING} onValueChange={(value) => navigateTo({ billing: value === ALL_BILLING ? '' : value })}>
          <SelectTrigger className="h-9 w-auto min-w-[10rem]">
            <SelectValue placeholder="All billing statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_BILLING}>All billing statuses</SelectItem>
            {BILLING_STATUS_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {statusLabel(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters ? (
          <Button type="button" variant="ghost" className="h-9" asChild>
            {/* prefetch off: see nav-list.tsx's comment — this shares a pathname with the
                sidebar's own "Billing report" link and every filter change on this page. */}
            <Link href="/billing" prefetch={false}>
              Clear
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
