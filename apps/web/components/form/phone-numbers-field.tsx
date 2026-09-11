'use client';

import { Plus, X } from 'lucide-react';
import * as React from 'react';
import { useState } from 'react';
import PhoneInput from 'react-phone-number-input';
import flags from 'react-phone-number-input/flags';
import { Button } from '../ui/button';
import { FormField } from '../ui/form-field';
import { CountrySelect } from './country-select';
import { cn } from '../../lib/utils';

export interface PhoneNumbersFieldProps {
  name: string;
  label?: string;
  error?: string;
  /** How many numbers this field allows. Defaults to 3 (candidate's own contact numbers); pass 1 for a single-contact field like an emergency contact. */
  maxNumbers?: number;
  /** Pre-fill — e.g. a candidate's existing `contactNumber` (comma-joined) split back into entries, for editing an existing record. */
  defaultValues?: string[];
  disabled?: boolean;
  /**
   * Pass a list (e.g. ['Mobile', 'Home', 'Work']) to show a "type" dropdown
   * next to every entry, submitted as a parallel `${name}Type` array — for
   * fields where knowing *what kind* of number it is matters (the patient's
   * own numbers), unlike the candidate form's plain multi-number list.
   */
  typeOptions?: string[];
  defaultTypes?: string[];
  /** Caps the field's width so it doesn't stretch edge-to-edge in a wide layout — default keeps prior full-width behavior. */
  className?: string;
}

const NumberInput = React.forwardRef<HTMLInputElement, React.ComponentPropsWithoutRef<'input'>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    {...props}
    className={cn(
      'h-9 flex-1 border-0 bg-transparent text-sm shadow-none outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
  />
));
NumberInput.displayName = 'PhoneNumberInput';

const TYPE_SELECT_CLASS =
  'h-9 w-[6.5rem] shrink-0 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

/**
 * One or more phone numbers under the same field name (FormData.getAll picks
 * up every hidden input's value — see lib/phone-number.ts's
 * combineContactNumbers). Built on react-phone-number-input, with a custom
 * searchable, flag-and-dial-code CountrySelect swapped in for its default
 * plain <select> (see country-select.tsx). `limitMaxLength` stops the
 * national number at however many digits are valid for the chosen country,
 * and the library owns the input's caret itself, so backspace behaves
 * normally instead of fighting a hand-rolled formatter.
 *
 * `defaultCountry="JM"` is only a starting guess (most candidates are local)
 * — picking a different flag fully switches the dial code and format,
 * nothing here assumes every number is Jamaican/+1. `countryCallingCodeEditable
 * ={false}` stops the "+1" prefix itself from being hand-edited in the text
 * field, which is what caused it to keep snapping back to "1" — the calling
 * code should only ever change via the flag picker, never by typing over it.
 *
 * The library's own text input only ever holds the national-number part —
 * the full E.164 value lives in this component's state — so each entry is
 * submitted through a parallel hidden input rather than the visible one.
 */
export function PhoneNumbersField({
  name,
  label = 'Contact number',
  error,
  maxNumbers = 3,
  defaultValues,
  disabled = false,
  typeOptions,
  defaultTypes,
  className
}: PhoneNumbersFieldProps) {
  const [numbers, setNumbers] = useState<Array<string | undefined>>(defaultValues?.length ? defaultValues : [undefined]);
  const [types, setTypes] = useState<string[]>(() => {
    if (!typeOptions?.length) return [];
    const seeded = defaultTypes ?? [];
    return numbers.map((_, i) => seeded[i] ?? typeOptions[Math.min(i, typeOptions.length - 1)]!);
  });

  function updateNumber(index: number, value: string | undefined) {
    setNumbers((prev) => prev.map((existing, i) => (i === index ? value : existing)));
  }

  function updateType(index: number, value: string) {
    setTypes((prev) => prev.map((existing, i) => (i === index ? value : existing)));
  }

  function addNumber() {
    setNumbers((prev) => (prev.length < maxNumbers ? [...prev, undefined] : prev));
    if (typeOptions?.length) {
      setTypes((prev) => (prev.length < maxNumbers ? [...prev, typeOptions[Math.min(prev.length, typeOptions.length - 1)]!] : prev));
    }
  }

  function removeNumber(index: number) {
    setNumbers((prev) => prev.filter((_, i) => i !== index));
    setTypes((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <FormField label={label} name={name} error={error} className={className}>
      <div className="flex flex-col gap-2">
        {numbers.map((value, index) => (
          <div key={index} className="flex items-center gap-2">
            {typeOptions?.length ? (
              <select
                name={`${name}Type`}
                value={types[index] ?? typeOptions[0]}
                onChange={(event) => updateType(index, event.target.value)}
                disabled={disabled}
                className={TYPE_SELECT_CLASS}
                aria-label="Phone type"
              >
                {typeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : null}
            <PhoneInput
              id={index === 0 ? name : undefined}
              className="ncb-phone-input"
              defaultCountry="JM"
              international
              countryCallingCodeEditable={false}
              limitMaxLength
              flags={flags}
              countrySelectComponent={CountrySelect}
              inputComponent={NumberInput}
              value={value}
              onChange={(next) => updateNumber(index, next)}
              placeholder="Phone number"
              disabled={disabled}
            />
            <input type="hidden" name={name} value={value ?? ''} />
            {!disabled && numbers.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => removeNumber(index)}
                aria-label="Remove this number"
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        ))}
        {!disabled && numbers.length < maxNumbers ? (
          <Button type="button" variant="link" size="sm" className="h-auto w-fit p-0" onClick={addNumber}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add another number
          </Button>
        ) : null}
      </div>
    </FormField>
  );
}
