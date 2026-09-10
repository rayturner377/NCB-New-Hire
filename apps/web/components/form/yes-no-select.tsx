'use client';

import { useEffect, useRef } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export interface YesNoSelectProps {
  name: string;
  /** '' (unanswered) | 'yes' | 'no' — deliberately no default beyond '', so a question can't read as "answered No" before the patient has actually touched it. */
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  ariaLabel?: string;
}

/**
 * A shadcn Select standing in for a plain Yes/No `<select>` on a real
 * (server-action, no-JS-required) form — same shape as components/form/
 * select-field.tsx, but as a `text` hidden input (not `type="hidden"`) so
 * `required` actually participates in native constraint validation (the same
 * trick date-field.tsx uses): a `type="hidden"` input is exempt from
 * validity checks, which is exactly how these questions used to silently
 * read as "complete" while still unanswered. Controlled (`value`/
 * `onValueChange`) rather than `defaultValue`, since the hidden input needs
 * to mirror whatever's currently selected, not just the initial value. The
 * hidden input is `position: absolute` (Tailwind's `sr-only`), so it never
 * disrupts whatever flex/grid layout `className` places the trigger into.
 *
 * Deliberately NOT `readOnly` on that hidden input, even though nothing
 * should ever type into it directly — confirmed by driving a real browser
 * against this exact field that `readOnly` is *also* one of the conditions
 * the HTML spec bars from constraint validation, same as `type="hidden"`:
 * `checkValidity()` returned `true` for it while empty and `required`,
 * regardless of the tab's visibility, purely because of `readOnly`. A no-op
 * `onChange` satisfies React's "controlled input needs a change handler"
 * requirement without re-introducing that exemption.
 *
 * A plain native `<select>`'s change bubbles as a real DOM event, which is
 * how the enclosing form's own `onChange` (patient-case-form.tsx's
 * `handleFormChange`, which re-checks section completeness on every change)
 * used to find out a question got answered. Radix's Select is a `<button>`
 * under the hood — picking an item never fires a native event on anything,
 * so swapping in this component silently broke that: a family/medical
 * history section could look permanently stuck at its initial completeness
 * regardless of what got answered. The effect below restores the same
 * "something changed" signal by dispatching a real, bubbling `input` event
 * on the hidden field whenever its value changes, without having to thread a
 * new callback prop through every tab/row that uses this.
 */
export function YesNoSelect({ name, value, onValueChange, disabled, required = true, className, ariaLabel }: YesNoSelectProps) {
  const hiddenRef = useRef<HTMLInputElement>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    hiddenRef.current?.dispatchEvent(new Event('input', { bubbles: true }));
  }, [value]);

  return (
    <>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger aria-label={ariaLabel} className={className}>
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="no">No</SelectItem>
          <SelectItem value="yes">Yes</SelectItem>
        </SelectContent>
      </Select>
      <input
        ref={hiddenRef}
        type="text"
        name={name}
        required={required}
        value={value}
        onChange={() => {}}
        aria-hidden="true"
        tabIndex={-1}
        className="sr-only"
      />
    </>
  );
}
