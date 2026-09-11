'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DateRangeInputs } from '../../../../components/dashboard/date-range-inputs';
import { Button } from '../../../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../components/ui/select';
import { statusLabel } from '../../../../lib/status-labels';
import { caseStatusSchema } from '../../../cases/schemas/case';

export interface DoctorCaseHistoryFiltersProps {
  /** Where this dashboard actually lives — '/' for a doctor viewing their own, '/doctors/<id>' for an admin viewing someone else's (see doctor-overview-container.tsx). */
  basePath: string;
  status: string;
  from: string;
  to: string;
  hasActiveFilters: boolean;
}

const ALL_STATUSES = '__all__';

/** Status options a doctor's history can actually be in — excludes draft/sent_to_patient/sent_to_doctor, none of which a case sits in once it's left the inbox. */
const HISTORY_STATUSES = caseStatusSchema.options.filter(
  (status) => !['draft', 'sent_to_patient', 'patient_completed', 'sent_to_doctor'].includes(status)
);

/** Auto-applies on change, same pattern as features/cases/components/cases-filters.tsx — status and dates navigate immediately, no Apply button. */
export function DoctorCaseHistoryFilters({ basePath, status, from, to, hasActiveFilters }: DoctorCaseHistoryFiltersProps) {
  const router = useRouter();

  function navigate(next: Partial<{ status: string; from: string; to: string }>) {
    const merged = { status, from, to, ...next };
    const params = new URLSearchParams();
    if (merged.status) params.set('status', merged.status);
    if (merged.from) params.set('from', merged.from);
    if (merged.to) params.set('to', merged.to);
    const search = params.toString();
    router.push(search ? `${basePath}?${search}` : basePath);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end gap-2">
        <DateRangeInputs from={from} to={to} onFromChange={(value) => navigate({ from: value })} onToChange={(value) => navigate({ to: value })} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={status || ALL_STATUSES} onValueChange={(value) => navigate({ status: value === ALL_STATUSES ? '' : value })}>
          <SelectTrigger className="h-9 w-auto min-w-[10rem]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUSES}>All statuses</SelectItem>
            {HISTORY_STATUSES.map((option) => (
              <SelectItem key={option} value={option}>
                {statusLabel(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters ? (
          <Button type="button" variant="ghost" className="h-9" asChild>
            <Link href={basePath}>Clear</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
