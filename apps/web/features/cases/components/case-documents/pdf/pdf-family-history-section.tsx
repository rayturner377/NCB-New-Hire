import { FAMILY_DISORDER_CATALOG, type PatientCaseData } from '../../../patient-case-data';
import { PdfBannerHeading, PdfCheckboxColumns, PdfField, PdfGridBox, PdfSubheading, type PdfGridCellDef } from './pdf-primitives';

export interface PdfFamilyHistorySectionProps {
  patientCaseData: PatientCaseData;
}

export function PdfFamilyHistorySection({ patientCaseData }: PdfFamilyHistorySectionProps) {
  const relatives = patientCaseData.familyHistory.relatives.filter((relative) => relative.relative);

  const relativeRows: PdfGridCellDef[][] = relatives.map((relative) => [
    { label: 'Relative', value: relative.relative },
    { label: 'Age (if alive)', value: relative.ageIfAlive },
    { label: 'State of health / cause of death', value: relative.healthOrCauseOfDeath, weight: 2 },
    { label: 'Age at death', value: relative.ageAtDeath }
  ]);

  return (
    <>
      <PdfBannerHeading>Family History</PdfBannerHeading>
      {relativeRows.length > 0 ? <PdfGridBox rows={relativeRows} /> : null}

      <PdfSubheading>Have members of your family had the following illnesses or disorders?</PdfSubheading>
      <PdfCheckboxColumns
        columns={3}
        items={FAMILY_DISORDER_CATALOG.map((item) => {
          const entry = patientCaseData.familyHistory.disorders[item.key];
          return { label: item.label, checked: entry?.answer === 'yes', detail: entry?.who };
        })}
      />
      <PdfField label="Family history notes" value={patientCaseData.familyHistory.notes} />
    </>
  );
}
