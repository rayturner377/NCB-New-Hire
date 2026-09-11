'use client';

import { useState } from 'react';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '../../lib/utils';

export interface MeasurementUnitOption {
  value: string;
  label: string;
}

export interface MeasurementInputProps {
  /** Field name for the numeric value. */
  valueName: string;
  /** Field name for the chosen unit (submitted via a hidden input, same pattern as every other shadcn Select in a plain form — see components/form/select-field.tsx). */
  unitName: string;
  units: MeasurementUnitOption[];
  defaultValue?: string;
  defaultUnit?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}

/**
 * A number paired with a unit picker — for any measurement where the number
 * alone is ambiguous (170 what? cm? inches?) and the doctor needs to choose
 * which scale they're recording in, rather than the app silently assuming
 * one. `min={0}` enforces "absolute number" (no negative height/weight) as
 * real constraint validation, the same as any other required field the
 * shared tabbed-form-shell's generic completeness check already relies on.
 */
export function MeasurementInput({ valueName, unitName, units, defaultValue = '', defaultUnit, required, className, disabled }: MeasurementInputProps) {
  const [unit, setUnit] = useState(defaultUnit || units[0]?.value || '');

  return (
    <div className={cn('flex gap-2', className)}>
      <Input
        type="number"
        step="any"
        min={0}
        inputMode="decimal"
        name={valueName}
        defaultValue={defaultValue}
        required={required}
        disabled={disabled}
        className="flex-1"
      />
      <Select value={unit} onValueChange={setUnit} disabled={disabled}>
        <SelectTrigger className="w-24 shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {units.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input type="hidden" name={unitName} value={unit} />
    </div>
  );
}
