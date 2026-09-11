import { Text, View } from '@react-pdf/renderer';
import type { SubmissionPayload } from '../../../../submissions/types';
import { PdfBoxedFreeText, PdfSectionHeading, PdfUnderlineField } from './pdf-primitives';
import { pdfStyles } from './pdf-styles';

export interface PdfDeterminationSectionProps {
  submission: SubmissionPayload;
}

const DETERMINATION_LABELS: Record<string, string> = {
  fit: 'Cleared fit for employment on medical grounds',
  fit_with_restrictions: 'Cleared fit for employment on medical grounds, with restrictions',
  temporarily_deferred: 'Not fit for employment on medical grounds — temporarily deferred',
  not_fit: 'Not fit for employment on medical grounds'
};

const CLEARED_STATUSES = new Set(['fit', 'fit_with_restrictions']);

export function PdfDeterminationSection({ submission }: PdfDeterminationSectionProps) {
  const { determination } = submission;
  const isCleared = CLEARED_STATUSES.has(determination.status);
  const isNotFit = !isCleared && Boolean(determination.status);

  return (
    <>
      <PdfSectionHeading>Determination</PdfSectionHeading>
      <PdfBoxedFreeText label="Conclusions (opinion on the physical and mental health of the candidate and fitness for duty)" value={determination.conclusions} />
      <PdfBoxedFreeText label="Restrictions" value={determination.restrictions} />
      <PdfBoxedFreeText label="Recommendation" value={determination.recommendation} />
      <PdfUnderlineField label="Follow-up date" value={determination.followUpDate} />

      <View style={{ marginTop: 6 }} wrap={false}>
        <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 3 }}>Please check the applicable box:</Text>
        <View style={pdfStyles.checkboxRow}>
          <View style={[pdfStyles.checkbox, isCleared ? pdfStyles.checkboxChecked : undefined]} />
          <Text>Cleared Fit For Employment on Medical Grounds</Text>
        </View>
        <View style={pdfStyles.checkboxRow}>
          <View style={[pdfStyles.checkbox, isNotFit ? pdfStyles.checkboxChecked : undefined]} />
          <Text>Not Fit For Employment on Medical Grounds</Text>
        </View>
        {determination.status ? <Text style={pdfStyles.footerNote}>{DETERMINATION_LABELS[determination.status] ?? determination.status}</Text> : null}
      </View>
    </>
  );
}
