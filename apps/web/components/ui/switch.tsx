'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'value'> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

/**
 * A plain button-based switch (role="switch", not a Radix primitive — this
 * project has no @radix-ui/react-switch dependency and the interaction is
 * simple enough not to need one) styled to match the rest of components/ui's
 * shadcn conventions (--primary track when on, same focus ring as Button).
 */
export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked, onCheckedChange, className, ...props }, ref) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      ref={ref}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-input',
        className
      )}
      {...props}
    >
      <span
        className={cn(
          'pointer-events-none block h-4 w-4 rounded-full bg-background shadow transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0'
        )}
      />
    </button>
  )
);
Switch.displayName = 'Switch';
