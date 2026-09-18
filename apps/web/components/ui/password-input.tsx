'use client';

import { forwardRef, useState, type ComponentProps } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from './input';
import { cn } from '../../lib/utils';

/**
 * A password `<Input>` with a show/hide toggle — every password field in the
 * app (sign-in, change-password, setting a temporary password for someone
 * else) goes through this instead of a bare `type="password"` Input, so
 * whoever's typing can double-check what they entered before submitting.
 * Forwards its ref and every other Input prop straight through; only `type`
 * is owned by this component (toggled between 'password' and 'text').
 */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<ComponentProps<typeof Input>, 'type'>>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = useState(false);

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? 'text' : 'password'}
          // Edge injects its own native reveal-password icon into any type="password" input once it
          // has a value — left unsuppressed, it overlaps this component's own toggle button, showing
          // two "eyes" at once. `::-ms-reveal`/`::-ms-clear` are the (Edge/IE-specific, harmless
          // no-ops elsewhere) pseudo-elements that icon renders as.
          className={cn('pr-9 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden', className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
          tabIndex={-1}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  }
);
PasswordInput.displayName = 'PasswordInput';
