'use client';

import { useState } from 'react';
import { YesNoSelect } from '../../../../components/form/yes-no-select';
import { FormField } from '../../../../components/ui/form-field';
import { Input } from '../../../../components/ui/input';
import { cn } from '../../../../lib/utils';
import {
  MEDICAL_DISEASE_CATALOG,
  MEDICAL_QUESTION_CATALOG,
  type CatalogAnswer,
  type MedicalQuestionItem,
  type PatientCaseData
} from '../../patient-case-data';
import { ANSWER_HIGHLIGHT_CLASS } from './answer-highlight';
import { DiseaseQuestionRow } from './disease-question-row';

const TEXTAREA_CLASS =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

function QuestionBlock({ item, answer, disabled }: { item: MedicalQuestionItem; answer?: CatalogAnswer; disabled: boolean }) {
  if (item.kind === 'text') {
    return (
      <FormField label={item.question} name={`question.${item.key}.detail`} required>
        <Input
          name={`question.${item.key}.detail`}
          defaultValue={answer?.detail ?? ''}
          required
          disabled={disabled}
          className={cn(disabled && answer?.detail && ANSWER_HIGHLIGHT_CLASS)}
        />
      </FormField>
    );
  }
  if (item.kind === 'textarea') {
    return (
      <FormField label={item.question} name={`question.${item.key}.detail`} required>
        <textarea
          name={`question.${item.key}.detail`}
          rows={3}
          defaultValue={answer?.detail ?? ''}
          required
          disabled={disabled}
          className={cn(TEXTAREA_CLASS, disabled && answer?.detail && ANSWER_HIGHLIGHT_CLASS)}
        />
      </FormField>
    );
  }

  return <YesNoQuestion item={item} answer={answer} disabled={disabled} />;
}

function YesNoQuestion({ item, answer, disabled }: { item: MedicalQuestionItem; answer?: CatalogAnswer; disabled: boolean }) {
  const [value, setValue] = useState<string>(answer?.answer ?? '');
  const showDetail = value === 'yes';

  return (
    <div className="flex flex-col gap-3 border-b pb-4 last:border-b-0 last:pb-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium">
          {item.question}
          <span className="ml-0.5 text-destructive">*</span>
        </p>
        <YesNoSelect
          name={`question.${item.key}.answer`}
          value={value}
          onValueChange={setValue}
          disabled={disabled}
          className={cn('sm:w-32', disabled && value === 'yes' && ANSWER_HIGHLIGHT_CLASS)}
          ariaLabel={`${item.question} — answer`}
        />
      </div>

      {showDetail ? (
        <div className="flex flex-col gap-3">
          <FormField label={item.detailLabel ?? 'Details'} name={`question.${item.key}.detail`} required>
            <textarea
              name={`question.${item.key}.detail`}
              rows={2}
              defaultValue={answer?.detail ?? ''}
              required
              disabled={disabled}
              className={cn(TEXTAREA_CLASS, disabled && ANSWER_HIGHLIGHT_CLASS)}
            />
          </FormField>
          {item.extraFields?.length ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {item.extraFields.map((field) => (
                <FormField key={field.key} label={field.label} name={`question.${item.key}.extra.${field.key}`}>
                  <Input
                    name={`question.${item.key}.extra.${field.key}`}
                    type={field.type}
                    defaultValue={answer?.extra?.[field.key] ?? ''}
                    disabled={disabled}
                    className={cn(disabled && answer?.extra?.[field.key] && ANSWER_HIGHLIGHT_CLASS)}
                  />
                </FormField>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <input type="hidden" name={`question.${item.key}.detail`} value="" />
      )}
    </div>
  );
}

export interface MedicalHistoryTabProps {
  data: PatientCaseData;
  disabled: boolean;
}

/** Ported from public/app.js's renderPatientMedicalCaseForm tab 2 (~L9521-9548) and its catalogs (~L9596-9641). Doctor/medical-office selection now lives in its own consent step — see consent-tab.tsx. */
export function MedicalHistoryTab({ data, disabled }: MedicalHistoryTabProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
        Each question requires a specific answer. If the questionnaire is not fully completed, processing your medical may be delayed.
      </p>

      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Have you suffered from any of the following diseases or disorders?<span className="ml-0.5 normal-case text-destructive">*</span>
        </p>
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {MEDICAL_DISEASE_CATALOG.map((item) => (
            <DiseaseQuestionRow key={item.key} itemKey={item.key} label={item.label} answer={data.medicalHistory.diseases[item.key]} disabled={disabled} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Additional medical questions</p>
        <div className="flex flex-col gap-3">
          {MEDICAL_QUESTION_CATALOG.map((item) => (
            <QuestionBlock key={item.key} item={item} answer={data.medicalHistory.questions[item.key]} disabled={disabled} />
          ))}
        </div>
      </div>

      <FormField label="Additional notes" name="medicalHistory.notes">
        <textarea
          name="medicalHistory.notes"
          rows={3}
          defaultValue={data.medicalHistory.notes}
          disabled={disabled}
          className={TEXTAREA_CLASS}
        />
      </FormField>
    </div>
  );
}
