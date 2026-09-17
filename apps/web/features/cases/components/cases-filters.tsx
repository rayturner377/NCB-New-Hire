'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DateRangeInputs } from '../../../components/dashboard/date-range-inputs';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { useDebouncedFilterNavigation } from '../../../lib/hooks/use-debounced-filter-navigation';
import { statusLabel } from '../../../lib/status-labels';
import { BILLING_STATUS_OPTIONS } from '../billing-status';
import { caseStatusSchema } from '../schemas/case';

export interface CasesFiltersProps {
  query: string;
  status: string;
  billing: string;
  from: string;
  to: string;
  hasActiveFilters: boolean;
}

const ALL_STATUSES = '__all__';
const ALL_BILLING = '__all__';

interface FilterValues {
  query: string;
  status: string;
  billing: string;
  from: string;
  to: string;
}

function buildHref({ query, status, billing, from, to }: FilterValues): string {
  // Always carries tab=all — this filter bar only ever renders on that tab
  // (see cases-container.tsx), and without it a filter change would land back
  // on the bare /cases URL, which now means Review queue.
  const params = new URLSearchParams({ tab: 'all' });
  if (query) params.set('query', query);
  if (status) params.set('status', status);
  if (billing) params.set('billing', billing);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  // Any filter change starts back at page 1 — the old page number rarely still makes sense against a different result set.
  return `/cases?${params.toString()}`;
}

/**
 * Auto-applies on every change — no Apply button. Dropdowns/dates navigate
 * immediately via useDebouncedFilterNavigation's `navigate`; the name search
 * debounces via its `navigateDebounced` so it doesn't re-fetch on every
 * keystroke, only once typing actually pauses. Each navigation is a plain
 * `router.push` to a new `?query=&status=...` URL, which cases-container.tsx
 * (a Server Component) re-reads via `searchParams` — the filtering/pagination
 * itself still happens server-side, this component only decides *when* to
 * ask for it.
 */
export function CasesFilters({ query: initialQuery, status, billing, from, to, hasActiveFilters }: CasesFiltersProps) {
  const { navigate, navigateDebounced } = useDebouncedFilterNavigation();
  const [query, setQuery] = useState(initialQuery);

  // Keeps the input in sync with the URL on back/forward navigation, without fighting the debounce below (navigateTo() below only ever pushes the same value already in state, so this never clobbers active typing).
  useEffect(() => setQuery(initialQuery), [initialQuery]);

  function navigateTo(next: Partial<FilterValues>) {
    navigate(buildHref({ query, status, billing, from, to, ...next }));
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    navigateDebounced(buildHref({ query: value, status, billing, from, to }));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end gap-2">
        <DateRangeInputs from={from} to={to} onFromChange={(value) => navigateTo({ from: value })} onToChange={(value) => navigateTo({ to: value })} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          value={query}
          onChange={(event) => handleQueryChange(event.target.value)}
          placeholder="Search by candidate name…"
          className="h-9 sm:max-w-xs"
        />

        <Select value={status || ALL_STATUSES} onValueChange={(value) => navigateTo({ status: value === ALL_STATUSES ? '' : value })}>
          <SelectTrigger className="h-9 w-auto min-w-[10rem]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUSES}>All statuses</SelectItem>
            {caseStatusSchema.options.map((option) => (
              <SelectItem key={option} value={option}>
                {statusLabel(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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
                sidebar's own "Cases" link and every filter change on this page. */}
            <Link href="/cases?tab=all" prefetch={false}>
              Clear
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
