'use client';

import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';

export interface ForcePasswordChangeFieldProps {
  defaultChecked?: boolean;
}

/**
 * "Require password change on first login" — the industry-standard pattern
 * (Moodle, most enterprise SSO/HR systems) for temporary admin-set
 * passwords: checked by default, since a password only the admin knows
 * shouldn't stay in place. Reused wherever a form both sets a temporary
 * password AND creates the account it logs into (Users' UserForm, and
 * CandidateForm's Portal Access section).
 */
export function ForcePasswordChangeField({ defaultChecked = true }: ForcePasswordChangeFieldProps) {
  return (
    <div className="flex items-start gap-2.5">
      <Checkbox id="forcePasswordChange" name="forcePasswordChange" defaultChecked={defaultChecked} className="mt-0.5" />
      <div className="flex flex-col gap-0.5">
        <Label htmlFor="forcePasswordChange" className="text-sm font-medium leading-none">
          Require password change on first login
        </Label>
        <p className="text-xs text-muted-foreground">
          They&apos;ll be asked to set their own password the first time they sign in with the temporary one above.
        </p>
      </div>
    </div>
  );
}
