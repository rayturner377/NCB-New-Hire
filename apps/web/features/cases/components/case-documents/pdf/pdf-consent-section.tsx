import { Image, Text, View } from '@react-pdf/renderer';
import { CONSENT_SECTIONS, type PatientCaseData } from '../../../patient-case-data';
import { PdfGridBox } from './pdf-primitives';
import { pdfStyles } from './pdf-styles';

export interface PdfConsentSectionProps {
  patientCaseData: PatientCaseData;
}

/**
 * The legal disclosure/consent text, verbatim from the paper form (see
 * patient-case-data.ts's CONSENT_SECTIONS — the same source the on-screen
 * ConsentTab renders from, so the exported copy can never say something
 * different from what the patient actually signed under), in the paper
 * form's own boxed layout: a bordered box, centered un-numbered section
 * headings, then a signature strip along the bottom.
 */
export function PdfConsentSection({ patientCaseData }: PdfConsentSectionProps) {
  return (
    <View style={pdfStyles.sectionSpacing}>
      <View style={pdfStyles.consentBox} wrap={false}>
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8.5 }}>DISCLOSURE AND CONSENT :</Text>
        {CONSENT_SECTIONS.map((section) => (
          <View key={section.heading}>
            <Text style={pdfStyles.consentSectionHeading}>{section.heading.replace(/^\d+\.\s*/, '')}</Text>
            {section.paragraphs.map((paragraph, index) => (
              <Text key={index} style={pdfStyles.consentParagraph}>
                {paragraph.map((run, runIndex) =>
                  run.bold ? (
                    <Text key={runIndex} style={pdfStyles.boldRun}>
                      {run.text}
                    </Text>
                  ) : (
                    <Text key={runIndex}>{run.text}</Text>
                  )
                )}
              </Text>
            ))}
          </View>
        ))}
      </View>

      <PdfGridBox
        rows={[
          [
            { label: 'Signature (Employee)', value: patientCaseData.consent.signedBy, weight: 2 },
            { label: 'Date', value: patientCaseData.consent.signedAt }
          ]
        ]}
      />
      {patientCaseData.consent.signatureDataUrl ? (
        <Image src={patientCaseData.consent.signatureDataUrl} style={pdfStyles.consentSignatureImage} />
      ) : null}
    </View>
  );
}
