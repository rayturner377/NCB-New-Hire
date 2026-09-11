'use client';

import { CalendarIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import type { Matcher } from 'react-day-picker';
import { Button } from '../ui/button';
import { Calendar } from '../ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { cn } from '../../lib/utils';

export interface DateFieldProps {
  name: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  /** ISO `yyyy-MM-dd`, for pre-filling an edit form. */
  defaultValue?: string;
  fromYear?: number;
  toYear?: number;
  /** Which month the calendar opens to when no date is picked yet — defaults to ~30 years back (a reasonable birthdate guess), which is wrong for anything that isn't a birthdate (a report date range, a follow-up date). Pass `new Date()` for those. */
  defaultMonth?: Date;
  /** Fired after a date is picked — lets a parent form re-run native validity checks, since setting a hidden input's value programmatically doesn't bubble a change event the way typing does. */
  onChange?: () => void;
  /** Fired with the new ISO `yyyy-MM-dd` value (or '' if cleared) — for a parent that needs the actual value, not just a "something changed" signal (see date-range-inputs.tsx, which uses this to keep two DateFields' allowed ranges in sync with each other). */
  onValueChange?: (value: string) => void;
  /** react-day-picker matcher(s) disabling specific dates in the popover — e.g. `{ before: someDate }` so an end-date field can't go earlier than whatever start date is already picked. */
  disabled?: Matcher | Matcher[];
  /** Disables the trigger itself (read-only display) — distinct from `disabled` above, which only restricts which dates the calendar allows once open. */
  readOnly?: boolean;
}

/**
 * A shadcn Popover+Calendar date picker that reads back as a real date
 * ("January 20, 1990") instead of the browser's native <input type="date">
 * widget, whose display format varies by OS/locale and locks the field to
 * whatever font its own dropdown uses. The chosen date is submitted through
 * a visually-hidden (but still `type="text"`, so `required` actually
 * participates in native form validation — `type="hidden"` inputs are
 * exempt from constraint validation) input under `name`. That hidden input
 * is deliberately NOT `readOnly` either, confirmed by driving a real browser
 * against an equivalent field (yes-no-select.tsx): `readOnly` is *also* one
 * of the conditions the HTML spec bars from constraint validation, so a
 * `readOnly` required field always reports valid regardless of its value. A
 * no-op `onChange` satisfies React's controlled-input requirement instead.
 */
export function DateField({
  name,
  id,
  required,
  placeholder = 'Pick a date',
  defaultValue,
  fromYear = 1940,
  toYear,
  defaultMonth,
  onChange,
  onValueChange,
  disabled,
  readOnly
}: DateFieldProps) {
  const [date, setDate] = useState<Date | undefined>(defaultValue ? parseISO(defaultValue) : undefined);
  const [open, setOpen] = useState(false);
  const isoValue = date ? format(date, 'yyyy-MM-dd') : '';

  // Runs after the hidden input's `value` attribute actually commits to the
  // DOM — calling `onChange` straight from `onSelect` fired a parent's
  // `checkValidity()` a tick too early, while the input still held its
  // previous (often empty) value, so the form stayed stuck invalid.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    onChange?.();
    onValueChange?.(isoValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isoValue]);

  return (
    <Popover open={open && !readOnly} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id ?? name}
          type="button"
          variant="outline"
          disabled={readOnly}
          className={cn('w-full justify-start px-3 text-left font-normal', !date && 'text-muted-foreground')}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          {date ? format(date, 'MMMM d, yyyy') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(next) => {
            setDate(next);
            setOpen(false);
          }}
          disabled={disabled}
          captionLayout="dropdown"
          startMonth={new Date(fromYear, 0)}
          endMonth={new Date(toYear ?? new Date().getFullYear(), 11)}
          defaultMonth={date ?? defaultMonth ?? new Date(toYear ?? new Date().getFullYear() - 30, 0)}
          autoFocus
        />
      </PopoverContent>
      <input
        type="text"
        name={name}
        required={required}
        value={isoValue}
        onChange={() => {}}
        aria-hidden="true"
        tabIndex={-1}
        className="sr-only"
      />
    </Popover>
  );
}
