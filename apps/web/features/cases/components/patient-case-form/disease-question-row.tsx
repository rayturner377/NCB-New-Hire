'use client';

import { useState } from 'react';
import { YesNoSelect } from '../../../../components/form/yes-no-select';
import { Input } from '../../../../components/ui/input';
import { cn } from '../../../../lib/utils';
import type { CatalogAnswer } from '../../patient-case-data';
import { ANSWER_HIGHLIGHT_CLASS } from './answer-highlight';

export interface DiseaseQuestionRowProps {
  itemKey: string;
  label: string;
  answer?: CatalogAnswer;
  disabled: boolean;
}

/**
 * One condition/answer/year row from the 28-item disease questionnaire
 * (features/cases/patient-case-data.ts's MEDICAL_DISEASE_CATALOG) — a
 * compact single line rather than a full-width table row, so two of these
 * can sit side by side (see medical-history-tab.tsx's 2-column grid) instead
 * of every condition eating the whole row for a yes/no answer and an
 * occasional year. Answer starts unset (not defaulted to "No") and is
 * required — see YesNoSelect's own comment for why that matters.
 */
export function DiseaseQuestionRow({ itemKey, label, answer, disabled }: DiseaseQuestionRowProps) {
  const [value, setValue] = useState<string>(answer?.answer ?? '');

  return (
    <div className="flex items-center gap-2 rounded-md border px-3 py-2">
      <span className="flex-1 text-sm">{label}</span>
      <YesNoSelect
        name={`disease.${itemKey}.answer`}
        value={value}
        onValueChange={setValue}
        disabled={disabled}
        className={cn('h-9 w-24 shrink-0', disabled && value === 'yes' && ANSWER_HIGHLIGHT_CLASS)}
        ariaLabel={`${label} — answer`}
      />
      {value === 'yes' ? (
        <Input
          name={`disease.${itemKey}.year`}
          type="number"
          min={1900}
          max={2100}
          defaultValue={answer?.year ?? ''}
          required
          disabled={disabled}
          placeholder="Year"
          className={cn('w-24 shrink-0', disabled && ANSWER_HIGHLIGHT_CLASS)}
          aria-label={`${label} — year`}
        />
      ) : (
        <input type="hidden" name={`disease.${itemKey}.year`} value="" />
      )}
    </div>
  );
}
