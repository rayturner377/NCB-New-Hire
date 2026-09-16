'use client';

import { useEffect, useRef } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export interface SelectInputOption {
  value: string;
  label: string;
}

export interface SelectInputProps {
  name: string;
  value: string;
  onValueChange: (value: string) => void;
  options: SelectInputOption[];
  placeholder?: string;
  disabled?: boolean;
  /** See this component's own doc comment — required participates in native constraint validation via a real (not type="hidden") input, same trick as yes-no-select.tsx. */
  required?: boolean;
  className?: string;
  id?: string;
  ariaLabel?: string;
}

/**
 * A shadcn Select standing in for a plain `<select>` on a real (server-action,
 * no-JS-required) form — generalized version of yes-no-select.tsx's fix for
 * the same two problems every such swap runs into:
 *
 * 1. Select itself doesn't participate in native form submission, so a
 *    hidden input mirrors whatever's currently selected into the form's
 *    FormData under `name`.
 * 2. When `required`, that hidden input is deliberately `type="text"` (kept
 *    off-screen via `sr-only`) rather than `type="hidden"` — a `type="hidden"`
 *    input is exempt from constraint validation entirely, so `required`
 *    would be silently ignored and a Submit/Save button could enable itself
 *    before anything was actually chosen.
 * 3. Radix's Select is a `<button>` under the hood — picking an item never
 *    fires a native DOM event the way a real `<select>`'s change does, which
 *    is how an enclosing form's own `onChange` (used for live
 *    completeness/validity checks elsewhere in this app) finds out a field
 *    changed. The effect below restores that signal by dispatching a real,
 *    bubbling `input` event on the hidden field whenever its value changes.
 */
export function SelectInput({
  name,
  value,
  onValueChange,
  options,
  placeholder = 'Select…',
  disabled,
  required = false,
  className,
  id,
  ariaLabel
}: SelectInputProps) {
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
        <SelectTrigger id={id} aria-label={ariaLabel} className={className}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {required ? (
        <input
          ref={hiddenRef}
          type="text"
          name={name}
          required
          value={value}
          onChange={() => {}}
          aria-hidden="true"
          tabIndex={-1}
          className="sr-only"
        />
      ) : (
        <input ref={hiddenRef} type="hidden" name={name} value={value} />
      )}
    </>
  );
}
