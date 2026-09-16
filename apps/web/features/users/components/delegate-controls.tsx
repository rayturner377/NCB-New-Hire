'use client';

import { useRef } from 'react';
import { Check, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { setUserActiveAction } from '../actions/set-user-active';
import { toggleDelegateBillingViewAction } from '../actions/toggle-delegate-billing-view';
import { Switch } from '../../../components/ui/switch';

/**
 * Active/Inactive as one labeled toggle — replaces a separate read-only
 * "Status" badge sitting apart from its own activate/deactivate switch,
 * which put the two furthest apart exactly where they're most related.
 * "Active"/"Inactive" sit directly against the switch that changes them,
 * with whichever one is currently true shown in full contrast and the other
 * dimmed, plus a check/× echoed in the thumb so the state reads at a glance
 * without leaning on color alone. A bespoke track+thumb (not the shared
 * Switch component) since this needs an icon inside the thumb that Switch
 * has no slot for.
 */
export function DelegateActiveSwitch({ delegateId, active }: { delegateId: string; active: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const activeInputRef = useRef<HTMLInputElement>(null);

  function toggle(checked: boolean) {
    if (activeInputRef.current) activeInputRef.current.value = String(checked);
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={setUserActiveAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="userId" value={delegateId} />
      <input ref={activeInputRef} type="hidden" name="active" defaultValue={String(!active)} />

      <span className={cn('text-xs font-medium', active ? 'text-foreground' : 'text-muted-foreground')}>Active</span>
      <button
        type="button"
        role="switch"
        aria-checked={active}
        aria-label={active ? 'Deactivate' : 'Activate'}
        onClick={() => toggle(!active)}
        className={cn(
          'inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          active ? 'bg-emerald-500' : 'bg-muted-foreground/30'
        )}
      >
        <span
          className={cn(
            'pointer-events-none flex h-4 w-4 items-center justify-center rounded-full bg-background shadow transition-transform',
            active ? 'translate-x-5' : 'translate-x-0'
          )}
        >
          {active ? <Check className="h-2.5 w-2.5 text-emerald-600" /> : <X className="h-2.5 w-2.5 text-muted-foreground" />}
        </span>
      </button>
      <span className={cn('text-xs font-medium', !active ? 'text-foreground' : 'text-muted-foreground')}>Inactive</span>
    </form>
  );
}

/** A doctor's own toggle for whether this delegate can see billing/payable-amount figures — same Switch treatment as DelegateActiveSwitch, submitting toggleDelegateBillingViewAction's own narrow, hardcoded-to-one-permission grant/revoke. */
export function DelegateBillingSwitch({ delegateId, canViewBilling }: { delegateId: string; canViewBilling: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const enabledInputRef = useRef<HTMLInputElement>(null);

  return (
    <form ref={formRef} action={toggleDelegateBillingViewAction}>
      <input type="hidden" name="delegateId" value={delegateId} />
      <input ref={enabledInputRef} type="hidden" name="enabled" defaultValue={String(!canViewBilling)} />
      <Switch
        checked={canViewBilling}
        aria-label={canViewBilling ? 'Turn off billing visibility' : 'Turn on billing visibility'}
        onCheckedChange={(checked) => {
          if (enabledInputRef.current) enabledInputRef.current.value = String(checked);
          formRef.current?.requestSubmit();
        }}
      />
    </form>
  );
}
