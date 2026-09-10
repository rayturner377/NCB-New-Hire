'use client';

import { useState } from 'react';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export interface SelectFieldOption {
  value: string;
  label: string;
}

export interface SelectFieldProps {
  name: string;
  label: string;
  defaultValue: string;
  options: SelectFieldOption[];
  id?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * A labeled shadcn Select for a plain (server-action, no-JS-required) form —
 * Select itself doesn't participate in native form submission the way a bare
 * `<select name="x">` does, so this pairs it with a hidden input that
 * mirrors the chosen value into the form's FormData under `name`. Meant for
 * exactly this shape (one dropdown, a real default, always a value chosen) —
 * a field that also needs `required`/native validity (e.g. the patient
 * intake form's questionnaire selects) isn't a fit yet, since a hidden input
 * doesn't participate in constraint validation either.
 */
export function SelectField({ name, label, defaultValue, options, id, className, disabled }: SelectFieldProps) {
  const [value, setValue] = useState(defaultValue);
  const fieldId = id ?? name;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={fieldId} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <Select value={value} onValueChange={setValue} disabled={disabled}>
        <SelectTrigger id={fieldId} className={className}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
