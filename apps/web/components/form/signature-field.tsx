'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { SignaturePad, type SignaturePadHandle } from './signature-pad';

export interface SignatureFieldProps {
  /** Hidden input name carrying the base64 PNG. */
  name: string;
  defaultValue?: string;
  /** The live value of the "Your full name" field elsewhere on the form — as it's typed, the pad fills in with a cursive rendering of it automatically. */
  typedName: string;
  disabled?: boolean;
  onChange?: (dataUrl: string) => void;
}

/** Three style choices for the typed-signature rendering — irrelevant once the patient draws by hand, since that's their own strokes, not a font. */
const SIGNATURE_FONTS = [
  { key: 'classic', label: 'Classic', family: '"Brush Script MT", cursive' },
  { key: 'elegant', label: 'Elegant', family: '"Lucida Handwriting", "Brush Script MT", cursive' },
  { key: 'bold', label: 'Bold', family: '"Segoe Script", "Brush Script MT", cursive' }
] as const;

/**
 * Signature capture, ported from the old app's canvas pad + "Use typed name"
 * button (public/app.js's LocalSignaturePad + drawTypedSignature,
 * ~L10120-10146) onto SignaturePad (components/form/signature-pad.tsx — a
 * fully-configurable wrapper around the widely-used signature_pad library)
 * instead of a hand-rolled pointer-event canvas.
 *
 * No separate "Draw"/"Type" mode toggle: typing into the name field above
 * fills the pad live, automatically, with no extra step — that's the whole
 * point of asking for the name first. Drawing directly on the pad takes over
 * from there (further typing stops overwriting a real signature); Clear
 * hands control back to the typed name. The 3-font picker only appears while
 * the current signature is the typed rendering — it's meaningless once a
 * hand-drawn signature is on the pad.
 */
export function SignatureField({ name, defaultValue = '', typedName, disabled = false, onChange }: SignatureFieldProps) {
  const padRef = useRef<SignaturePadHandle>(null);
  const [dataUrl, setDataUrl] = useState(defaultValue);
  const [source, setSource] = useState<'typed' | 'drawn'>('typed');
  const [font, setFont] = useState<(typeof SIGNATURE_FONTS)[number]['key']>('classic');
  const loadedRef = useRef(false);

  function emit(next: string) {
    setDataUrl(next);
    onChange?.(next);
  }

  function handlePadEnd(isEmpty: boolean) {
    // Any real stroke on the pad is a deliberate hand-drawn signature — stop letting the typed name overwrite it.
    setSource('drawn');
    emit(isEmpty ? '' : (padRef.current?.toDataUrl() ?? ''));
  }

  function clear() {
    padRef.current?.clear();
    setSource('typed');
    emit('');
  }

  function drawTyped(rawName: string, fontKey: (typeof SIGNATURE_FONTS)[number]['key']) {
    const value = rawName.trim();
    padRef.current?.clear();
    if (!value) {
      emit('');
      return;
    }
    const family = SIGNATURE_FONTS.find((f) => f.key === fontKey)?.family ?? SIGNATURE_FONTS[0].family;
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 140;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#17202a';
    ctx.font = `44px ${family}`;
    ctx.textBaseline = 'middle';
    ctx.fillText(value, 18, canvas.height / 2);
    const url = canvas.toDataURL('image/png');
    padRef.current?.fromDataUrl(url);
    emit(url);
  }

  // Live fill: as long as the pad hasn't been hand-drawn on, every keystroke (or font pick) updates the signature immediately.
  useEffect(() => {
    if (source === 'typed') drawTyped(typedName, font);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typedName, source, font]);

  useEffect(() => {
    if (defaultValue && !loadedRef.current) {
      loadedRef.current = true;
      setSource('drawn'); // a saved signature (drawn or previously typed) shouldn't be silently replaced the moment the name field next changes.
      padRef.current?.fromDataUrl(defaultValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (disabled) {
    return (
      <div className="flex flex-col gap-2">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt="Signature on file" className="h-[100px] w-full max-w-[480px] rounded-md border bg-white object-contain" />
        ) : (
          <p className="text-xs text-muted-foreground">No signature on file.</p>
        )}
        <input type="hidden" name={name} value={dataUrl} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">Fills in automatically as you type your name above — or draw your own signature below.</p>

      {source === 'typed' ? (
        <div className="flex flex-wrap gap-2">
          {SIGNATURE_FONTS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setFont(option.key)}
              className={cn(
                'rounded-md border px-3 py-1.5 text-lg leading-none text-foreground/90 transition-colors hover:bg-accent',
                font === option.key ? 'border-primary ring-1 ring-primary' : 'border-input'
              )}
              style={{ fontFamily: option.family }}
              aria-pressed={font === option.key}
              title={option.label}
            >
              {typedName.trim() || 'Signature'}
            </button>
          ))}
        </div>
      ) : null}

      <SignaturePad ref={padRef} className="max-w-[480px]" width={480} height={140} onEnd={handlePadEnd} />

      <div className="flex items-center gap-3">
        <Button type="button" size="sm" variant="ghost" onClick={clear}>
          Clear signature
        </Button>
        {dataUrl ? <span className="text-xs text-muted-foreground">Signature captured.</span> : null}
      </div>

      <input type="hidden" name={name} value={dataUrl} />
    </div>
  );
}
