'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { getCountryCallingCode, type Country } from 'react-phone-number-input';
import { Button } from '../ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { cn } from '../../lib/utils';

interface CountryOption {
  value?: Country;
  label: string;
  divider?: boolean;
}

export interface CountrySelectProps {
  value?: Country;
  options: CountryOption[];
  onChange: (country: Country | undefined) => void;
  iconComponent: React.ComponentType<{ country?: Country; label: string }>;
  disabled?: boolean;
  readOnly?: boolean;
}

/**
 * Searchable flag + name + dial-code country picker, swapped in via
 * PhoneNumbersField's `countrySelectComponent` prop in place of
 * react-phone-number-input's default (an unstyled native <select> with 240+
 * options to scroll through). `iconComponent` and `options` are supplied by
 * the library itself — see its CountrySelectWithIcon for the shape this is
 * standing in for.
 */
export function CountrySelect({ value, options, onChange, iconComponent: Icon, disabled, readOnly }: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const countries = options.filter((option): option is CountryOption & { value: Country } => !option.divider && Boolean(option.value));
  const selected = countries.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          aria-label={selected ? selected.label : 'Select country'}
          disabled={disabled || readOnly}
          className="h-7 shrink-0 gap-1 px-1.5 font-normal"
        >
          <Icon country={selected?.value} label={selected?.label ?? 'International'} />
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search country…" />
          <CommandList>
            <CommandEmpty>No country found.</CommandEmpty>
            <CommandGroup>
              {countries.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('h-4 w-4 shrink-0', option.value === value ? 'opacity-100' : 'opacity-0')} />
                  <Icon country={option.value} label={option.label} />
                  <span className="flex-1 truncate">{option.label}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">+{getCountryCallingCode(option.value)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
