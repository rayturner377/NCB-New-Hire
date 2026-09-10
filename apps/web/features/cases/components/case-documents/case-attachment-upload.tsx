'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Alert } from '../../../../components/ui/alert';
import { Button } from '../../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { uploadCaseAttachmentAction } from '../../actions/upload-case-attachment';

export interface CaseAttachmentUploadProps {
  caseId: string;
  /** Set to grey out the upload control instead of hiding it — the reason shown below it (e.g. the doctor hasn't submitted an assessment to stamp yet). Omit/undefined to leave it enabled. */
  lockedMessage?: string;
}

/**
 * Upload a stamped/scanned copy of the printed assessment — its own
 * component (separate from exporting the PDF, see case-pdf-export.tsx) and
 * deliberately not a `<form>`: this can be shown as one tab among several
 * that are all part of one bigger submission `<form>` elsewhere on the page
 * (the doctor's own assessment form), and a `<form>` nested inside another
 * `<form>` is invalid HTML — browsers handle it unpredictably. Calling the
 * server action directly (the same function a `<form action={...}>` would
 * call) sidesteps that entirely; this component owns its own pending/error
 * state instead of getting it from `useFormState`.
 */
export function CaseAttachmentUpload({ caseId, lockedMessage }: CaseAttachmentUploadProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError('Choose a PDF file to upload.');
      return;
    }

    setPending(true);
    setError(null);

    const formData = new FormData();
    formData.set('caseId', caseId);
    formData.set('file', file);

    const result = await uploadCaseAttachmentAction(null, formData);

    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'That upload failed.');
      return;
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Upload stamped copy</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <fieldset disabled={Boolean(lockedMessage)} className="contents">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="attachment-file" className="text-xs font-normal text-muted-foreground">
                PDF file
              </Label>
              <Input id="attachment-file" ref={fileInputRef} type="file" accept="application/pdf" className="h-9 w-64" />
            </div>
            <Button type="button" size="sm" onClick={handleUpload} disabled={pending}>
              {pending ? 'Uploading…' : 'Upload'}
            </Button>
          </div>
        </fieldset>
        <p className="text-xs text-muted-foreground">
          {lockedMessage ?? "Once you've printed and physically stamped the exported form, scan it back in as a PDF here."}
        </p>
        {error ? <Alert tone="error">{error}</Alert> : null}
      </CardContent>
    </Card>
  );
}
