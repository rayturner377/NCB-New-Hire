'use client';

import { useState, type ChangeEvent } from 'react';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';

export interface LogoUploadFieldProps {
  name: string;
  label: string;
  hint: string;
  defaultValue?: string;
}

/** Raw file bytes, not the base64 data URL's own character length — checked up front so an oversized file gets a clear, immediate message instead of silently failing later at the server's request-size limit (see next.config.mjs's serverActions.bodySizeLimit) or the schema's own data-URL length cap (features/settings/schemas/settings.ts). */
const MAX_FILE_BYTES = 2 * 1024 * 1024;

/**
 * Reads a chosen image file as a data URL client-side and mirrors it into a
 * hidden field under `name`, so the surrounding `<form>` submits the image
 * inline with everything else on the General settings tab — no separate
 * upload endpoint or asset storage needed (see settings-service.ts: the
 * whole settings object, logos included, is one encrypted row).
 */
export function LogoUploadField({ name, label, hint, defaultValue = '' }: LogoUploadFieldProps) {
  const [dataUrl, setDataUrl] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);

    if (file.size > MAX_FILE_BYTES) {
      setError(`That file is ${(file.size / (1024 * 1024)).toFixed(1)}MB — please choose one under ${MAX_FILE_BYTES / (1024 * 1024)}MB.`);
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setDataUrl(String(reader.result));
    reader.onerror = () => setError("Couldn't read that file — try a different image.");
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        {dataUrl ? (
          // A data: URL preview — next/image doesn't accept those, so a plain <img> is correct here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt={label} className="h-14 w-auto max-w-[10rem] rounded border object-contain p-1" />
        ) : (
          <div className="flex h-14 w-28 items-center justify-center rounded border border-dashed text-[10px] text-muted-foreground">
            No image
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={handleFileChange} className="text-xs" />
          {dataUrl ? (
            <Button type="button" variant="ghost" size="sm" className="h-6 w-fit px-2 text-xs" onClick={() => setDataUrl('')}>
              Remove
            </Button>
          ) : null}
        </div>
      </div>
      <input type="hidden" name={name} value={dataUrl} onChange={() => {}} />
      <p className="text-xs text-muted-foreground">{hint}</p>
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
