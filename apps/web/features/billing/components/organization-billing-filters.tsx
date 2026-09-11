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
import { financialYearBounds } from '../financial-year';

export interface OrganizationBillingFiltersProps {
  doctors: { id: string; displayName: string }[];
  availableFinancialYears: string[];
  clinicianId: string;
  query: string;
  billing: string;
  /** Which FY (if any) the current from/to actually falls inside — 'all' when it doesn't cleanly match one (see organization-billing-report-container.tsx's containment-based resolveDateRange). Purely for what this dropdown displays; it's derived from from/to, not separate state. */
  fy: string;
  from: string;
  to: string;
  hasActiveFilters: boolean;
}

const ALL_DOCTORS = '__all__';
const ALL_BILLING = '__all__';
const ALL_TIME = 'all';
const DEBOUNCE_MS = 400;

interface FilterValues {
  query: string;
  billing: string;
  clinicianId: string;
  fy: string;
  from: string;
  to: string;
}

/**
 * Same auto-apply pattern as billing-report-filters.tsx, with a financial
 * year picker and a doctor picker added. Picking an FY writes its actual
 * Oct 1–Sep 30 bounds into `from`/`to` (so the date pickers below visibly
 * update to match, and going through page.tsx/resolveDateRange, an FY
 * selection and manually typing those exact same dates end up
 * indistinguishable — there's no separate "FY mode" flag to fall out of
 * sync with what the dates actually say). Editing a date field narrows or
 * escapes that range directly; whether the dropdown still shows the FY you
 * started from, or flips to "All", is entirely up to whether the resulting
 * range still fits inside it (see containingFinancialYear) — not tracked
 * here. Choosing a doctor switches the page from the org-wide per-doctor
 * summary to that doctor's own case-level detail (see
 * billing-report-service.ts's getOrganizationBillingReport).
 */
export function OrganizationBillingFilters({
  doctors,
  availableFinancialYears,
  clinicianId: initialClinicianId,
  query: initialQuery,
  billing,
  fy,
  from,
  to,
  hasActiveFilters
}: OrganizationBillingFiltersProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setQuery(initialQuery), [initialQuery]);
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  function navigate(next: Partial<FilterValues>) {
    const merged: FilterValues = { query, billing, clinicianId: initialClinicianId, fy: '', from, to, ...next };
    const params = new URLSearchParams();
    if (merged.clinicianId) params.set('clinicianId', merged.clinicianId);
    if (merged.query) params.set('query', merged.query);
    if (merged.billing) params.set('billing', merged.billing);
    if (merged.fy) params.set('fy', merged.fy);
    if (merged.from) params.set('from', merged.from);
    if (merged.to) params.set('to', merged.to);
    const search = params.toString();
    router.push(search ? `/billing?${search}` : '/billing');
  }

  function handleFySelect(value: string) {
    if (value === ALL_TIME) {
      navigate({ fy: ALL_TIME, from: '', to: '' });
      return;
    }
    const bounds = financialYearBounds(value);
    navigate({ from: bounds?.from ?? '', to: bounds?.to ?? '' });
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navigate({ query: value }), DEBOUNCE_MS);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Select value={fy} onValueChange={handleFySelect}>
          <SelectTrigger className="h-9 w-auto min-w-[9rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_TIME}>All time</SelectItem>
            {availableFinancialYears.map((label) => (
              <SelectItem key={label} value={label}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DateRangeInputs from={from} to={to} onFromChange={(value) => navigate({ from: value })} onToChange={(value) => navigate({ to: value })} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={initialClinicianId || ALL_DOCTORS} onValueChange={(value) => navigate({ clinicianId: value === ALL_DOCTORS ? '' : value })}>
          <SelectTrigger className="h-9 w-auto min-w-[12rem]">
            <SelectValue placeholder="All doctors" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_DOCTORS}>All doctors</SelectItem>
            {doctors.map((doctor) => (
              <SelectItem key={doctor.id} value={doctor.id}>
                {doctor.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {initialClinicianId ? (
          <Input
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
            placeholder="Search by candidate name…"
            className="h-9 sm:max-w-xs"
          />
        ) : null}

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
