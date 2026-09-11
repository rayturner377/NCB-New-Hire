import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { buttonVariants, type ButtonProps } from './button';
import { cn } from '../../lib/utils';

export interface DisclosureProps {
  label: string;
  icon?: LucideIcon;
  variant?: ButtonProps['variant'];
  children: ReactNode;
}

/**
 * A native `<details>`/`<summary>` toggle styled like a Button — reveals
 * `children` (e.g. a create-form) with no client JS required. Reusable
 * anywhere a page wants a "New X" trigger that expands a form in place
 * instead of always showing it or navigating away.
 */
export function Disclosure({ label, icon: Icon, variant = 'default', children }: DisclosureProps) {
  const isLink = variant === 'link';

  return (
    <details className="group">
      <summary
        className={cn(
          buttonVariants({ variant, size: isLink ? 'sm' : 'default' }),
          'w-fit cursor-pointer select-none list-none gap-1.5',
          isLink && 'h-auto p-0'
        )}
      >
        {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
        {label}
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}
