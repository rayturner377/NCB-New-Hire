'use client';

import { Download, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert } from '../../../../components/ui/alert';
import { Button } from '../../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { deleteCaseAttachmentAction } from '../../actions/delete-case-attachment';

export interface CaseDocumentSummary {
  id: string;
  originalName: string;
  byteSize: number;
  createdAt: string;
  uploaderName: string;
  canDelete: boolean;
}

export interface CaseAttachmentListProps {
  caseId: string;
  attachments: CaseDocumentSummary[];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DeleteButton({ caseId, attachmentId }: { caseId: string; attachmentId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setPending(true);
    setError(null);
    const formData = new FormData();
    formData.set('caseId', caseId);
    formData.set('attachmentId', attachmentId);
    const result = await deleteCaseAttachmentAction(null, formData);
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? 'That removal failed.');
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={handleDelete} disabled={pending} aria-label="Remove document">
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

/** Read-only list of what's already on file for this case — its own component (separate from uploading, see case-attachment-upload.tsx), so a viewer with no upload permission still sees everything already attached. */
export function CaseAttachmentList({ caseId, attachments }: CaseAttachmentListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Documents on file</CardTitle>
      </CardHeader>
      <CardContent>
        {attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {attachments.map((attachment) => (
              <li key={attachment.id} className="flex items-center justify-between gap-3 py-2">
                <a
                  href={`/cases/${caseId}/attachments/${attachment.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-w-0 items-center gap-2 text-sm text-primary hover:underline"
                >
                  <Download className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{attachment.originalName}</span>
                </a>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {formatBytes(attachment.byteSize)} · {attachment.uploaderName} · {new Date(attachment.createdAt).toLocaleDateString()}
                  </span>
                  {attachment.canDelete ? <DeleteButton caseId={caseId} attachmentId={attachment.id} /> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
