'use client';

import { PDFDownloadLink } from '@react-pdf/renderer';
import { FileDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { buttonVariants } from '../../../../components/ui/button';
import { Alert } from '../../../../components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { cn } from '../../../../lib/utils';
import type { PatientCaseData } from '../../patient-case-data';
import type { SubmissionPayload } from '../../../submissions/types';
import { MedicalAssessmentDocument } from './medical-assessment-document';

export interface CasePdfExportProps {
  caseId: string;
  candidate: { fullName: string; employeeId: string; dateOfBirth: string; email: string; contactNumber: string; position: string };
  caseTypeLabel: string;
  patientCaseData: PatientCaseData | null;
  submission: SubmissionPayload | null;
  /** Set to grey out the export button instead of hiding the section — the reason shown below it (e.g. the doctor hasn't submitted yet, or the case still needs HR review). Omit/undefined to leave it enabled. */
  lockedMessage?: string;
  /** The large logo configured under Settings → General — see medical-assessment-document.tsx. */
  logoUrl?: string;
}

/**
 * The real implementation — kept in its own module (rather than directly in
 * case-pdf-export.tsx) so that file can lazy-load this one via
 * `next/dynamic({ ssr: false })`. @react-pdf/renderer touches browser-only
 * APIs (canvas font measurement, etc.) that break — silently, the
 * "Export as PDF" link just does nothing when clicked — if this ever runs
 * during Next's server render pass; `ssr: false` is the documented fix, and
 * it doubles as free code-splitting: this component's real weight (a few
 * hundred KB) only downloads once someone actually opens the Documents tab
 * rather than loading with the rest of the page for everyone.
 *
 * The `document` element is memoized rather than built inline on every
 * render — <PDFDownloadLink> treats a new `document` reference as "the
 * content changed" and restarts rendering the PDF from scratch, which on a
 * page that re-renders on every keystroke (the doctor's form autosaves as
 * they type) meant it could get stuck perpetually back in its "Preparing…"
 * state and never settle into something actually clickable.
 */
export function CasePdfExportInner({ caseId, candidate, caseTypeLabel, patientCaseData, submission, lockedMessage, logoUrl }: CasePdfExportProps) {
  const [generationError, setGenerationError] = useState<string | null>(null);
  const documentElement = useMemo(
    () => (
      <MedicalAssessmentDocument
        caseId={caseId}
        candidate={candidate}
        caseTypeLabel={caseTypeLabel}
        patientCaseData={patientCaseData}
        submission={submission}
        logoUrl={logoUrl}
      />
    ),
    [caseId, candidate, caseTypeLabel, patientCaseData, submission, logoUrl]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Export</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {lockedMessage ? (
          <>
            <span className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-fit cursor-not-allowed opacity-50')}>
              <FileDown className="mr-1.5 h-3.5 w-3.5" /> Export as PDF
            </span>
            <p className="text-xs text-muted-foreground">{lockedMessage}</p>
          </>
        ) : (
          <>
            <PDFDownloadLink
              document={documentElement}
              fileName={`medical-assessment-${caseId}.pdf`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-fit no-underline')}
            >
              {({ loading, error }) => {
                const message = error ? error.message || String(error) : null;
                // Deferred a tick rather than called straight from here — this render-prop runs as
                // part of this component's own render, and setState synchronously mid-render (for a
                // value that didn't come from props) trips React's update-during-render warning.
                if (message !== generationError) {
                  queueMicrotask(() => setGenerationError(message));
                  if (message) console.error('PDF export failed:', error);
                }
                return (
                  <>
                    <FileDown className="mr-1.5 h-3.5 w-3.5" /> {loading ? 'Preparing…' : error ? 'Export failed' : 'Export as PDF'}
                  </>
                );
              }}
            </PDFDownloadLink>
            {generationError ? (
              <Alert tone="error">
                Couldn&apos;t generate the PDF: {generationError}. Open the browser console for the full error.
              </Alert>
            ) : null}
            <p className="text-xs text-muted-foreground">Downloads the full assessment as a PDF, ready to print and stamp.</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
