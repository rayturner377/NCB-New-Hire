'use client';

import { useFormStatus } from 'react-dom';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

export interface ValidatedSubmitButtonProps {
  formValid: boolean;
  label: string;
  pendingLabel: string;
}

/**
 * A submit button that stays clickable even while the form is invalid
 * (native `disabled` buttons swallow clicks with zero feedback — see
 * lib/hooks/use-validated-form.ts, whose `handleSubmit` is what actually
 * blocks and explains an invalid attempt), just visually muted until
 * `formValid`.
 */
export function ValidatedSubmitButton({ formValid, label, pendingLabel }: ValidatedSubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" aria-disabled={!formValid || pending} className={cn(!formValid && !pending && 'opacity-50')}>
      {pending ? pendingLabel : label}
    </Button>
  );
}
