'use client';

import { useState } from 'react';
import { YesNoSelect } from '../../../../components/form/yes-no-select';
import { Input } from '../../../../components/ui/input';
import { TableCell, TableRow } from '../../../../components/ui/table';
import { cn } from '../../../../lib/utils';
import type { CatalogAnswer } from '../../patient-case-data';
import { ANSWER_HIGHLIGHT_CLASS } from './answer-highlight';

export interface FamilyDisorderRowProps {
  itemKey: string;
  label: string;
  answer?: CatalogAnswer;
  disabled: boolean;
}

/**
 * One illness/disorder row from the family history questionnaire
 * (features/cases/patient-case-data.ts's FAMILY_DISORDER_CATALOG) — its own
 * component (rather than inlined in the .map() in family-history-tab.tsx)
 * because the Yes/No answer needs its own live state to drive both the
 * highlight styling and the "Who" field's relevance. Answer starts unset
 * (not defaulted to "No") and is required — see YesNoSelect's own comment
 * for why that matters.
 */
export function FamilyDisorderRow({ itemKey, label, answer, disabled }: FamilyDisorderRowProps) {
  const [value, setValue] = useState<string>(answer?.answer ?? '');

  return (
    <TableRow>
      <TableCell className="text-sm">{label}</TableCell>
      <TableCell>
        <YesNoSelect
          name={`disorder.${itemKey}.answer`}
          value={value}
          onValueChange={setValue}
          disabled={disabled}
          className={cn('w-full', disabled && value === 'yes' && ANSWER_HIGHLIGHT_CLASS)}
          ariaLabel={`${label} — answer`}
        />
      </TableCell>
      <TableCell>
        <Input
          name={`disorder.${itemKey}.who`}
          defaultValue={answer?.who ?? ''}
          disabled={disabled}
          placeholder="Relationship / name"
          className={cn(disabled && answer?.who && ANSWER_HIGHLIGHT_CLASS)}
        />
      </TableCell>
    </TableRow>
  );
}
