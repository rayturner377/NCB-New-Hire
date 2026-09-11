import { View } from '@react-pdf/renderer';
import { PHYSICIAN_EXAM_SECTIONS } from '../../../../submissions/physician-exam-sections';
import type { SubmissionPayload } from '../../../../submissions/types';
import { PdfBannerHeading, PdfBoxedFreeText, PdfFieldColumns, PdfSubheading, PdfUnderlineColumns, humanizeKey } from './pdf-primitives';

export interface PdfPhysicalExamSectionProps {
  submission: SubmissionPayload;
}

/** A single-field section (Disabilities, Pregnancy test) gets its own boxed free-text area rather than a fill-in-the-blank line, matching how the paper form gives those their own larger box. */
const BOXED_SECTION_IDS = new Set(['disabilities', 'pregnancyTest']);

/** "Completed by Physician" — grouped by the same canonical PHYSICIAN_EXAM_SECTIONS list the doctor's own form and the read-only SubmissionViewer use, and columned the same way the paper form pairs its own fields (2 or 3 per row depending on how many a system has). */
export function PdfPhysicalExamSection({ submission }: PdfPhysicalExamSectionProps) {
  const examEntries: Record<string, unknown> = { ...submission.vitals, ...submission.physicalExam };

  return (
    <>
      <PdfBannerHeading>Completed by Physician</PdfBannerHeading>
      {PHYSICIAN_EXAM_SECTIONS.map((section) => {
        const items = section.fields.map((field) => {
          const value = examEntries[field.key];
          const unit = examEntries[`${field.key}Unit`];
          return { label: field.label, value: unit && value ? `${value} ${unit}` : value };
        });

        return (
          <View key={section.id}>
            <PdfSubheading>{section.title}</PdfSubheading>
            {BOXED_SECTION_IDS.has(section.id) ? (
              items.map((item) => <PdfBoxedFreeText key={item.label} label={item.label} value={item.value} />)
            ) : (
              <PdfUnderlineColumns items={items} columns={items.length >= 5 ? 3 : 2} />
            )}
          </View>
        );
      })}

      <PdfSubheading>Laboratory</PdfSubheading>
      <PdfFieldColumns
        columns={3}
        items={Object.entries(submission.labResults).map(([key, value]) => ({ label: humanizeKey(key), value }))}
      />
    </>
  );
}
