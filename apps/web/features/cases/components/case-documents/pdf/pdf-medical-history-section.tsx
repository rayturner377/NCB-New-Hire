import { MEDICAL_DISEASE_CATALOG, MEDICAL_QUESTION_CATALOG, type PatientCaseData } from '../../../patient-case-data';
import { PdfCheckboxColumns, PdfField, PdfSectionHeading, PdfSubheading, PdfUnderlineField } from './pdf-primitives';

export interface PdfMedicalHistorySectionProps {
  patientCaseData: PatientCaseData;
}

export function PdfMedicalHistorySection({ patientCaseData }: PdfMedicalHistorySectionProps) {
  const longFormQuestions = MEDICAL_QUESTION_CATALOG.filter((item) => item.kind !== 'yesno');
  const yesNoQuestions = MEDICAL_QUESTION_CATALOG.filter((item) => item.kind === 'yesno');

  return (
    <>
      <PdfSectionHeading>Medical history</PdfSectionHeading>

      <PdfSubheading>Have you suffered from any of the following diseases or disorders?</PdfSubheading>
      <PdfCheckboxColumns
        columns={3}
        items={MEDICAL_DISEASE_CATALOG.map((item) => {
          const entry = patientCaseData.medicalHistory.diseases[item.key];
          return { label: item.label, checked: entry?.answer === 'yes', detail: entry?.year };
        })}
      />

      <PdfSubheading>Additional medical questions</PdfSubheading>
      {/* Each still shows as its own fill-in-the-blank line, whether or not there's an answer to write on it — a "No" answer just skips the describe/explain detail. */}
      {yesNoQuestions.map((item) => {
        const answer = patientCaseData.medicalHistory.questions[item.key];
        const answered = answer?.answer === 'yes' ? 'Yes' : 'No';
        return (
          <PdfUnderlineField
            key={item.key}
            label={item.question}
            value={answer?.answer === 'yes' && answer.detail ? `${answered} — ${answer.detail}` : answered}
          />
        );
      })}
      {longFormQuestions.map((item) => {
        const answer = patientCaseData.medicalHistory.questions[item.key];
        return <PdfUnderlineField key={item.key} label={item.question} value={answer?.detail} />;
      })}
      <PdfField label="Medical history notes" value={patientCaseData.medicalHistory.notes} />
    </>
  );
}
