import { Button } from '../ui/button';
import { DateRangeInputs } from './date-range-inputs';

export interface DateRangeFilterProps {
  from: string;
  to: string;
}

/**
 * Plain GET form — no client JS needed, matching the rest of this app's
 * no-JS-required form pattern. Submitting re-navigates to the same page with
 * ?from=&to= in the URL, which the Server Component page reads back out via
 * `searchParams` to decide which stat cards recompute. See date-range-inputs.tsx
 * for the actual input pair, shared with the cases list's combined filter form.
 */
export function DateRangeFilter({ from, to }: DateRangeFilterProps) {
  return (
    <form className="flex flex-nowrap items-center justify-end gap-2">
      <DateRangeInputs from={from} to={to} />
      <Button type="submit" className="h-[34px]">
        Apply
      </Button>
    </form>
  );
}
