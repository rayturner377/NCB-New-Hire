export interface CaseReference {
  caseId: string;
  expectedVersion: number;
}

/**
 * Pulls & validates caseId/caseVersion off a submitted FormData — shared by
 * create-submission.ts's final submit and save-submission-draft.ts's autosave,
 * which both post the same two hidden fields and need identical validation
 * (a version that doesn't parse to a finite number is exactly as invalid as a
 * missing one). Returns null rather than throwing so each caller can supply
 * its own error message.
 */
export function parseCaseReference(formData: FormData): CaseReference | null {
  const caseId = String(formData.get('caseId') || '');
  const expectedVersion = Number.parseInt(String(formData.get('caseVersion') || ''), 10);
  if (!caseId || !Number.isFinite(expectedVersion)) {
    return null;
  }
  return { caseId, expectedVersion };
}
