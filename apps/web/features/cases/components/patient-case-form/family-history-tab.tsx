'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { SelectInput } from '../../../../components/form/select-input';
import { Button } from '../../../../components/ui/button';
import { FormField } from '../../../../components/ui/form-field';
import { Input } from '../../../../components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/table';
import { FAMILY_DISORDER_CATALOG, FAMILY_RELATIVE_OPTIONS, type FamilyRelativeRow, type PatientCaseData } from '../../patient-case-data';
import { FamilyDisorderRow } from './family-disorder-row';

const RELATIVE_OPTIONS = FAMILY_RELATIVE_OPTIONS.map((option) => ({ value: option, label: option }));

/** The relative-relationship dropdown for one family-history row — its own component (rather than inlined in the .map() below) since the Select needs its own local state, which a loop body can't hold directly. */
function FamilyRelativeSelect({ defaultValue, disabled }: { defaultValue: string; disabled: boolean }) {
  const [value, setValue] = useState(defaultValue);
  return <SelectInput name="familyRelative.relative" value={value} onValueChange={setValue} options={RELATIVE_OPTIONS} disabled={disabled} />;
}

const TEXTAREA_CLASS =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

export interface FamilyHistoryTabProps {
  data: PatientCaseData;
  relatives: FamilyRelativeRow[];
  onAddRelative: () => void;
  onRemoveRelative: (index: number) => void;
  disabled: boolean;
}

/** Ported from public/app.js's renderPatientMedicalCaseForm tab 1 (~L9488-9516) and its catalogs (~L9581-9593). */
export function FamilyHistoryTab({ data, relatives, onAddRelative, onRemoveRelative, disabled }: FamilyHistoryTabProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Family relatives</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Relative</TableHead>
              <TableHead>Age, if alive</TableHead>
              <TableHead>State of health / cause of death</TableHead>
              <TableHead>Age at death</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {relatives.map((row, index) => (
              <TableRow key={index}>
                <TableCell>
                  <FamilyRelativeSelect defaultValue={row.relative} disabled={disabled} />
                </TableCell>
                <TableCell>
                  <Input name="familyRelative.ageIfAlive" type="number" min={0} max={130} defaultValue={row.ageIfAlive} disabled={disabled} />
                </TableCell>
                <TableCell>
                  <Input name="familyRelative.healthOrCauseOfDeath" defaultValue={row.healthOrCauseOfDeath} disabled={disabled} />
                </TableCell>
                <TableCell>
                  <Input name="familyRelative.ageAtDeath" type="number" min={0} max={130} defaultValue={row.ageAtDeath} disabled={disabled} />
                </TableCell>
                <TableCell>
                  {!disabled && relatives.length > 1 ? (
                    <Button type="button" variant="ghost" size="icon" onClick={() => onRemoveRelative(index)} aria-label="Remove relative">
                      <X className="h-4 w-4" />
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!disabled ? (
          <Button type="button" variant="link" size="sm" className="h-auto w-fit p-0" onClick={onAddRelative}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add relative
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Family illnesses or disorders<span className="ml-0.5 normal-case text-destructive">*</span>
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Illness / disorder</TableHead>
              <TableHead className="w-32">
                Answer<span className="ml-0.5 text-destructive">*</span>
              </TableHead>
              <TableHead>Who</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {FAMILY_DISORDER_CATALOG.map((item) => (
              <FamilyDisorderRow
                key={item.key}
                itemKey={item.key}
                label={item.label}
                answer={data.familyHistory.disorders[item.key]}
                disabled={disabled}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      <FormField label="Additional notes" name="familyHistory.notes">
        <textarea
          name="familyHistory.notes"
          rows={3}
          defaultValue={data.familyHistory.notes}
          disabled={disabled}
          className={TEXTAREA_CLASS}
        />
      </FormField>
    </div>
  );
}
