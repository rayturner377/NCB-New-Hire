'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DateRangeInputs } from '../../../components/dashboard/date-range-inputs';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { useDebouncedFilterNavigation } from '../../../lib/hooks/use-debounced-filter-navigation';
import { CASE_MILESTONES, type CaseMilestoneKey, milestonesFrom } from '../case-milestones';

export interface TurnaroundReportFiltersProps {
  fromMilestone: CaseMilestoneKey;
  toMilestone: CaseMilestoneKey;
  query: string;
  from: string;
  to: string;
  hasActiveFilters: boolean;
}

interface FilterValues {
  fromMilestone: string;
  toMilestone: string;
  query: string;
  from: string;
  to: string;
}

function buildHref(values: FilterValues): string {
  const params = new URLSearchParams();
  if (values.fromMilestone) params.set('fromMilestone', values.fromMilestone);
  if (values.toMilestone) params.set('toMilestone', values.toMilestone);
  if (values.query) params.set('query', values.query);
  if (values.from) params.set('from', values.from);
  if (values.to) params.set('to', values.to);
  const search = params.toString();
  return search ? `/reports/turnaround?${search}` : '/reports/turnaround';
}

/**
 * The "from"/"to" milestone pickers are what turn this from a fixed HR-only report into a general
 * one — the "to" picker only ever offers milestones at or after whichever one is picked as "from"
 * (milestonesFrom), so there's no way to ask for a turnaround that runs backwards through the
 * lifecycle. Picking a new "from" that's later than the current "to" moves "to" forward to match,
 * for the same reason.
 */
export function TurnaroundReportFilters({ fromMilestone, toMilestone, query: initialQuery, from, to, hasActiveFilters }: TurnaroundReportFiltersProps) {
  const { navigate, navigateDebounced } = useDebouncedFilterNavigation();
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => setQuery(initialQuery), [initialQuery]);

  function navigateTo(next: Partial<FilterValues>) {
    navigate(buildHref({ fromMilestone, toMilestone, query, from, to, ...next }));
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    navigateDebounced(buildHref({ fromMilestone, toMilestone, query: value, from, to }));
  }

  function handleFromMilestoneChange(value: string) {
    const stillValid = milestonesFrom(value as CaseMilestoneKey).some((milestone) => milestone.key === toMilestone);
    navigateTo({ fromMilestone: value, toMilestone: stillValid ? toMilestone : value });
  }

  const toOptions = milestonesFrom(fromMilestone);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="turnaround-from-milestone" className="text-xs font-normal text-muted-foreground">
            From
          </Label>
          <Select value={fromMilestone} onValueChange={handleFromMilestoneChange}>
            <SelectTrigger id="turnaround-from-milestone" className="h-9 w-auto min-w-[12rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CASE_MILESTONES.map((milestone) => (
                <SelectItem key={milestone.key} value={milestone.key}>
                  {milestone.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="turnaround-to-milestone" className="text-xs font-normal text-muted-foreground">
            To
          </Label>
          <Select value={toMilestone} onValueChange={(value) => navigateTo({ toMilestone: value })}>
            <SelectTrigger id="turnaround-to-milestone" className="h-9 w-auto min-w-[12rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {toOptions.map((milestone) => (
                <SelectItem key={milestone.key} value={milestone.key}>
                  {milestone.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto flex gap-2">
          <DateRangeInputs from={from} to={to} onFromChange={(value) => navigateTo({ from: value })} onToChange={(value) => navigateTo({ to: value })} />
        </div>
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
            <Link href="/reports/turnaround" prefetch={false}>
              Clear
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
