'use client';

import { useState, type ChangeEvent } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Switch } from '../../../components/ui/switch';
import { cn } from '../../../lib/utils';

export interface LoginImageFieldProps {
  label: string;
  hint: string;
  defaultDataUrl?: string;
  defaultUrl?: string;
  defaultMode?: 'upload' | 'url';
}

/** Same cap as logo-upload-field.tsx's own MAX_FILE_BYTES — see that file's comment for why. */
const MAX_FILE_BYTES = 2 * 1024 * 1024;

/**
 * The login screen's right-hand image, either uploaded inline (a data URL,
 * same as logo-upload-field.tsx) or linked by URL to an image hosted
 * elsewhere — an admin picks which with the Switch below. Both values are
 * tracked in this component's own state independently and submitted as two
 * separate hidden fields (loginImageDataUrl / loginImageUrl) alongside which
 * one is active (loginImageMode) — switching modes back and forth only ever
 * changes which one is *used*, never clears the other, so an already-uploaded
 * photo is still there if the admin switches back from URL mode later.
 */
export function LoginImageField({ label, hint, defaultDataUrl = '', defaultUrl = '', defaultMode = 'upload' }: LoginImageFieldProps) {
  const [mode, setMode] = useState<'upload' | 'url'>(defaultMode);
  const [dataUrl, setDataUrl] = useState(defaultDataUrl);
  const [url, setUrl] = useState(defaultUrl);
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

  const previewSrc = mode === 'url' ? url : dataUrl;

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>

      <div className="flex items-center gap-2.5">
        <span className={cn('text-xs font-medium', mode === 'upload' ? 'text-foreground' : 'text-muted-foreground')}>Upload</span>
        <Switch checked={mode === 'url'} onCheckedChange={(checked) => setMode(checked ? 'url' : 'upload')} aria-label="Switch between upload and URL" />
        <span className={cn('text-xs font-medium', mode === 'url' ? 'text-foreground' : 'text-muted-foreground')}>Link (URL)</span>
      </div>

      <div className="flex items-center gap-3">
        {previewSrc ? (
          // A data: URL or an arbitrary external URL — next/image doesn't accept data: URLs, and the
          // external host isn't known ahead of time either, so a plain <img> is correct here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewSrc} alt={label} className="h-14 w-auto max-w-[10rem] rounded border object-contain p-1" />
        ) : (
          <div className="flex h-14 w-28 items-center justify-center rounded border border-dashed text-[10px] text-muted-foreground">
            No image
          </div>
        )}

        <div className="flex flex-1 flex-col gap-1.5">
          {mode === 'upload' ? (
            <>
              <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={handleFileChange} className="text-xs" />
              {dataUrl ? (
                <Button type="button" variant="ghost" size="sm" className="h-6 w-fit px-2 text-xs" onClick={() => setDataUrl('')}>
                  Remove
                </Button>
              ) : null}
            </>
          ) : (
            <Input
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/photo.jpg"
              className="h-8 text-xs"
            />
          )}
        </div>
      </div>

      <input type="hidden" name="loginImageDataUrl" value={dataUrl} onChange={() => {}} />
      <input type="hidden" name="loginImageUrl" value={url} onChange={() => {}} />
      <input type="hidden" name="loginImageMode" value={mode} onChange={() => {}} />

      <p className="text-xs text-muted-foreground">{hint}</p>
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
