'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import { Alert } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Checkbox } from '../../../components/ui/checkbox';
import { Label } from '../../../components/ui/label';
import type { PermissionOption } from '../../../lib/permissions';
import { updateUserPermissionOverridesAction } from '../actions/update-user-permission-overrides';

export interface UserPermissionOverridesFormProps {
  userId: string;
  allPermissions: PermissionOption[];
  grant: string[];
  revoke: string[];
}

/**
 * "Extra permissions" — the one-off exception case (an HR reviewer who needs a permission the
 * rest of the reviewer role doesn't have) without inventing a new role for one person. Separate
 * `<form>` from EditUserDialog's own name/profile edit, so saving one never touches the other.
 * Only ever rendered for a viewer holding ROLES_MANAGE — see users-table.tsx.
 */
export function UserPermissionOverridesForm({ userId, allPermissions, grant, revoke }: UserPermissionOverridesFormProps) {
  const [state, formAction] = useFormState(updateUserPermissionOverridesAction, null);
  const [grantSet, setGrantSet] = useState(new Set(grant));
  const [revokeSet, setRevokeSet] = useState(new Set(revoke));

  function toggle(set: Set<string>, setter: (next: Set<string>) => void, key: string) {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setter(next);
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 border-t pt-4">
      <div className="flex items-center justify-between">
        <Label>Extra permissions</Label>
        <Button type="submit" variant="outline" size="sm">
          Save overrides
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">On top of what their role already grants — for a one-off exception, not a new role.</p>
      <input type="hidden" name="userId" value={userId} />

      <div className="max-h-56 overflow-y-auto rounded-md border p-2">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="pb-1 font-medium">Permission</th>
              <th className="w-16 pb-1 text-center font-medium">Grant</th>
              <th className="w-16 pb-1 text-center font-medium">Revoke</th>
            </tr>
          </thead>
          <tbody>
            {allPermissions.map((option) => (
              <tr key={option.key} className="border-t">
                <td className="py-1 pr-2">
                  {option.group.replace(/_/g, ' ')}: {option.label}
                </td>
                <td className="py-1 text-center">
                  <Checkbox
                    name="grant"
                    value={option.key}
                    checked={grantSet.has(option.key)}
                    onCheckedChange={() => toggle(grantSet, setGrantSet, option.key)}
                  />
                </td>
                <td className="py-1 text-center">
                  <Checkbox
                    name="revoke"
                    value={option.key}
                    checked={revokeSet.has(option.key)}
                    onCheckedChange={() => toggle(revokeSet, setRevokeSet, option.key)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="success">Saved.</Alert> : null}
    </form>
  );
}
