'use client';

import { Document, Page, Text, View } from '@react-pdf/renderer';
import type { PatientCaseData } from '../../patient-case-data';
import type { SubmissionPayload } from '../../../submissions/types';
import { PdfConsentSection } from './pdf/pdf-consent-section';
import { PdfDeterminationSection } from './pdf/pdf-determination-section';
import { PdfEmployeeSection } from './pdf/pdf-employee-section';
import { PdfFamilyHistorySection } from './pdf/pdf-family-history-section';
import { PdfHeaderSection } from './pdf/pdf-header-section';
import { PdfMedicalHistorySection } from './pdf/pdf-medical-history-section';
import { PdfBannerHeading } from './pdf/pdf-primitives';
import { PdfPhysicalExamSection } from './pdf/pdf-physical-exam-section';
import { PdfPhysicianSection } from './pdf/pdf-physician-section';
import { pdfStyles } from './pdf/pdf-styles';

export interface MedicalAssessmentDocumentProps {
  caseId: string;
  candidate: { fullName: string; employeeId: string; dateOfBirth: string; email: string; contactNumber: string; position: string };
  caseTypeLabel: string;
  patientCaseData: PatientCaseData | null;
  submission: SubmissionPayload | null;
  /** The large logo configured under Settings → General — see pdf-header-section.tsx. */
  logoUrl?: string;
  /** See PdfEmployeeSection's own doc comment — omits "Position applied for" for a doctor/delegate viewer. */
  hidePosition?: boolean;
}

/**
 * The exported assessment, built with @react-pdf/renderer's own component
 * model rather than an imperative PDF library — this is what CasePdfExport
 * (case-pdf-export.tsx) hands to <PDFDownloadLink>, which renders and
 * downloads it entirely in the browser.
 *
 * Broken into one sub-component per section (see ./pdf/) rather than one
 * long file — each owns its own slice of the data and renders through the
 * shared compact-columns/wide-field primitives in ./pdf/pdf-primitives.tsx,
 * which is also the actual fix for pages that used to be mostly blank space
 * next to a one-word "Yes"/"No": short answers now sit two or three to a
 * row instead of each claiming the full page width. Free-text fields
 * (conclusions, notes) still get a full-width row since forcing a paragraph
 * into a narrow column just wraps it awkwardly.
 *
 * A `break` before the physician section forces it onto its own fresh page,
 * matching the real form's own page 3 ("TO BE COMPLETED BY THE EXAMINING
 * PHYSICIAN") — everything else flows and paginates automatically wherever
 * it naturally runs long, which is react-pdf's default <Page> behavior.
 */
export function MedicalAssessmentDocument({ candidate, patientCaseData, submission, logoUrl, hidePosition }: MedicalAssessmentDocumentProps) {
  return (
    <Document title={`Medical assessment — ${candidate.fullName}`}>
      <Page size="LETTER" style={pdfStyles.page} wrap>
        <PdfHeaderSection logoUrl={logoUrl} />
        <PdfEmployeeSection candidate={candidate} patientCaseData={patientCaseData} hidePosition={hidePosition} />

        {patientCaseData ? (
          <>
            <PdfFamilyHistorySection patientCaseData={patientCaseData} />
            <PdfMedicalHistorySection patientCaseData={patientCaseData} />
            <PdfConsentSection patientCaseData={patientCaseData} />
          </>
        ) : null}

        {submission ? (
          <View break>
            <PdfPhysicalExamSection submission={submission} />
            <PdfDeterminationSection submission={submission} />
            <PdfPhysicianSection submission={submission} />
          </View>
        ) : (
          <View break>
            <PdfBannerHeading>Completed by Physician</PdfBannerHeading>
            <Text style={{ marginTop: 6 }}>No doctor assessment has been submitted for this case yet.</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}
