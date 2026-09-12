import { View } from '@react-pdf/renderer';
import type { SubmissionPayload } from '../../../../submissions/types';
import { PdfGridBox, PdfSectionHeading, type PdfGridCellDef } from './pdf-primitives';
import { PdfSignatureBlock } from './pdf-signature-block';

export interface PdfPhysicianSectionProps {
  submission: SubmissionPayload;
}

/** Examining physician identity, in the paper form's own bordered "EXAMINING PHYSICIAN INFORMATION" box, plus their attestation signature and a reserved stamp box — the paper form's own "Signature & Stamp:" field, made explicit here since a printed copy of this export is exactly what a physician would stamp. */
export function PdfPhysicianSection({ submission }: PdfPhysicianSectionProps) {
  const { assessment, attestation } = submission;

  const rows: PdfGridCellDef[][] = [
    [
      { label: 'Physician name', value: assessment.clinicianName, weight: 2 },
      { label: 'Telephone no.', value: assessment.telephoneNumber },
      { label: 'Fax no.', value: assessment.faxNumber }
    ],
    [
      { label: 'Registration number', value: assessment.clinicianRegistrationNumber },
      { label: 'E-mail address', value: assessment.emailAddress, weight: 2 }
    ],
    [
      { label: 'Medical facility', value: assessment.facilityName },
      { label: 'Address (street, town, district or province, country)', value: assessment.facilityAddress, weight: 2 }
    ],
    [{ label: 'Assessment date', value: assessment.assessmentDate }]
  ];

  return (
    <>
      <PdfSectionHeading>Examining physician information</PdfSectionHeading>
      <PdfGridBox rows={rows} />
      <View style={{ marginTop: 8 }}>
        <PdfSignatureBlock signedBy={attestation.signedBy} signedAt={attestation.signatureDate} signatureDataUrl={attestation.signatureDataUrl} showStampBox />
      </View>
    </>
  );
}
