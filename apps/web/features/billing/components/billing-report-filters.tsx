'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { DateRangeInputs } from '../../../components/dashboard/date-range-inputs';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
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
const DEBOUNCE_MS = 400;

/** Auto-applies on change, same pattern as features/cases/components/cases-filters.tsx — the status dropdown is a shadcn Select (not a bare `<select>`) for the same styling every other dropdown in the app now uses. */
export function BillingReportFilters({ query: initialQuery, billing, from, to, hasActiveFilters }: BillingReportFiltersProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setQuery(initialQuery), [initialQuery]);
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  function navigate(next: Partial<{ query: string; billing: string; from: string; to: string }>) {
    const merged = { query, billing, from, to, ...next };
    const params = new URLSearchParams();
    if (merged.query) params.set('query', merged.query);
    if (merged.billing) params.set('billing', merged.billing);
    if (merged.from) params.set('from', merged.from);
    if (merged.to) params.set('to', merged.to);
    const search = params.toString();
    router.push(search ? `/billing?${search}` : '/billing');
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navigate({ query: value }), DEBOUNCE_MS);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end gap-2">
        <DateRangeInputs from={from} to={to} onFromChange={(value) => navigate({ from: value })} onToChange={(value) => navigate({ to: value })} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={query}
          onChange={(event) => handleQueryChange(event.target.value)}
          placeholder="Search by candidate name…"
          className="h-9 sm:max-w-xs"
        />

        <Select value={billing || ALL_BILLING} onValueChange={(value) => navigate({ billing: value === ALL_BILLING ? '' : value })}>
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
