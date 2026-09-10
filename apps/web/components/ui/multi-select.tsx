'use client';

import { useState } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { Button } from './button';
import { Checkbox } from './checkbox';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList, CommandEmpty } from './command';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { cn } from '../../lib/utils';

export interface MultiSelectOption {
  value: string;
  label: string;
}

export interface MultiSelectGroup {
  /** Omit for a flat, ungrouped option list. */
  label?: string;
  options: MultiSelectOption[];
}

export interface MultiSelectPopoverProps {
  groups: MultiSelectGroup[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
}

/**
 * Checkbox-list popover for "filter by any of these" — same Popover+Command
 * shell as combobox.tsx, but toggles membership in an array instead of
 * picking one value, and stays open after a click so several boxes can be
 * ticked in one visit. Options can be flat or grouped under a heading (see
 * audit-log-filters.tsx's case/user/session activity groups).
 */
export function MultiSelectPopover({
  groups,
  selected,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  className
}: MultiSelectPopoverProps) {
  const [open, setOpen] = useState(false);
  const allOptions = groups.flatMap((group) => group.options);
  const selectedLabels = allOptions.filter((option) => selected.includes(option.value)).map((option) => option.label);

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  }

  const triggerText =
    selectedLabels.length === 0 ? placeholder : selectedLabels.length === 1 ? selectedLabels[0] : `${selectedLabels.length} selected`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className={cn('justify-between font-normal', className)}>
          <span className={cn('truncate', selectedLabels.length === 0 && 'text-muted-foreground')}>{triggerText}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[14rem] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            {groups.map((group, index) => (
              <CommandGroup key={group.label ?? index} heading={group.label}>
                {group.options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => toggle(option.value)}
                    className="cursor-pointer"
                  >
                    <Checkbox checked={selected.includes(option.value)} className="mr-2" />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
