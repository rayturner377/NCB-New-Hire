import { parseISO } from 'date-fns';
import { DateField } from '../form/date-field';
import { Label } from '../ui/label';

export interface DateRangeInputsProps {
  from: string;
  to: string;
  /** Namespaces the field names, e.g. "createdFrom"/"createdTo" — default keeps the plain "from"/"to" DateRangeFilter has always used. */
  fromName?: string;
  toName?: string;
  /** Auto-apply callers (e.g. cases-filters.tsx) pass these to react to a picked date immediately, instead of waiting on a submit button. Omit for a plain GET-form field (DateRangeFilter's own use). */
  onFromChange?: (value: string) => void;
  onToChange?: (value: string) => void;
}

/**
 * Just the two labeled date pickers, no `<form>`/submit button of its own —
 * extracted out of DateRangeFilter so a page that already has its own filter
 * form (e.g. the cases list's name/status/date filters) can drop these in
 * without nesting a second `<form>` inside the first. DateRangeFilter itself
 * now wraps this for its own single-purpose use (see that file).
 *
 * Uses the same shadcn Popover+Calendar DateField as the candidate form's
 * date of birth, not a bare `<input type="date">` — and each field disables
 * the dates that would make the range invalid in the other direction (the
 * "To" calendar can't go earlier than "From", and vice versa), everywhere
 * this component is used (cases, candidates-adjacent dashboards, both
 * billing reports).
 */
export function DateRangeInputs({ from, to, fromName = 'from', toName = 'to', onFromChange, onToChange }: DateRangeInputsProps) {
  return (
    <>
      <div className="flex items-center gap-1.5">
        <Label htmlFor={fromName} className="text-xs font-normal text-muted-foreground">
          From
        </Label>
        <div className="w-[170px]">
          {/* Keyed by the current value so an externally-driven change (e.g. picking a financial year, which sets `from` programmatically rather than through this field's own popover) actually remounts and re-reads `defaultValue` — DateField is intentionally uncontrolled otherwise, matching every other use of it. */}
          <DateField
            key={from}
            id={fromName}
            name={fromName}
            defaultValue={from}
            defaultMonth={new Date()}
            onValueChange={onFromChange}
            disabled={to ? { after: parseISO(to) } : undefined}
          />
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <Label htmlFor={toName} className="text-xs font-normal text-muted-foreground">
          To
        </Label>
        <div className="w-[170px]">
          <DateField
            key={to}
            id={toName}
            name={toName}
            defaultValue={to}
            defaultMonth={new Date()}
            onValueChange={onToChange}
            disabled={from ? { before: parseISO(from) } : undefined}
          />
        </div>
      </div>
    </>
  );
}
