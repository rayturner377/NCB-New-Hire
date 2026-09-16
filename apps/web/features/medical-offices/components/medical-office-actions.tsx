'use client';

import { useRef } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Switch } from '../../../components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui/tooltip';
import { deleteMedicalOfficeAction } from '../actions/delete-medical-office';
import { setMedicalOfficeActiveAction } from '../actions/set-medical-office-active';

/** Activate/deactivate for one facility — same Switch+Tooltip treatment as users-table.tsx's own ActiveSwitch, submitting the instant it's toggled. Deactivating just drops this office out of the doctor-creation facility picker (listActiveMedicalOfficeOptions); it stays visible/manageable here since the admin table itself reads from listAllMedicalOffices(). */
export function MedicalOfficeActiveSwitch({ officeId, active }: { officeId: string; active: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const activeInputRef = useRef<HTMLInputElement>(null);

  return (
    <form ref={formRef} action={setMedicalOfficeActiveAction}>
      <input type="hidden" name="officeId" value={officeId} />
      <input ref={activeInputRef} type="hidden" name="active" defaultValue={String(!active)} />
      <Tooltip>
        <TooltipTrigger asChild>
          <Switch
            checked={active}
            aria-label={active ? 'Deactivate' : 'Activate'}
            onCheckedChange={(checked) => {
              if (activeInputRef.current) activeInputRef.current.value = String(checked);
              formRef.current?.requestSubmit();
            }}
          />
        </TooltipTrigger>
        <TooltipContent>{active ? 'Deactivate' : 'Activate'}</TooltipContent>
      </Tooltip>
    </form>
  );
}

/** Soft-deletes the facility (with a confirm prompt, since this can't be undone from the UI) — same trash-icon+tooltip treatment as users-table.tsx's own delete control. */
export function DeleteMedicalOfficeButton({ officeId, officeName }: { officeId: string; officeName: string }) {
  return (
    <form action={deleteMedicalOfficeAction}>
      <input type="hidden" name="officeId" value={officeId} />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="submit"
            variant="outline"
            size="icon"
            className="text-destructive hover:text-destructive"
            aria-label="Delete"
            onClick={(event) => {
              if (!window.confirm(`Delete ${officeName}? This can't be undone.`)) {
                event.preventDefault();
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Delete</TooltipContent>
      </Tooltip>
    </form>
  );
}
