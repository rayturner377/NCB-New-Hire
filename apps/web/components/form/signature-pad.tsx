'use client';

import { forwardRef, useImperativeHandle, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { cn } from '../../lib/utils';

export interface SignaturePadHandle {
  clear: () => void;
  isEmpty: () => boolean;
  toDataUrl: () => string;
  fromDataUrl: (dataUrl: string) => void;
}

export interface SignaturePadProps {
  className?: string;
  /** Canvas pixel dimensions — the drawing surface is this size regardless of how wide it renders (react-signature-canvas scales for devicePixelRatio internally). */
  width?: number;
  height?: number;
  penColor?: string;
  backgroundColor?: string;
  /** Stroke width range in pixels — lower values (thinner default: 0.4–1.6) read as a lighter, smoother ballpoint-pen line; raise both for a bolder marker feel. */
  minWidth?: number;
  maxWidth?: number;
  /** Higher = smoother/slower-responding strokes (signature_pad default is 0.7). */
  velocityFilterWeight?: number;
  /** Minimum distance in pixels between recorded points — lower values trace more faithfully but cost more points. */
  minDistance?: number;
  onEnd?: (isEmpty: boolean) => void;
}

/**
 * Thin, fully-configurable wrapper around `react-signature-canvas` (the
 * signature_pad library) — every stroke-feel knob signature_pad exposes is a
 * prop here, not hard-coded, so a caller can widen the pad, thin the line,
 * or change the ink color without touching this file. Used by SignatureField
 * (draw-or-type toggle + hidden-field wiring); this component only owns the
 * actual drawing surface.
 */
export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(function SignaturePad(
  {
    className,
    width = 480,
    height = 140,
    penColor = '#17202a',
    backgroundColor = '#ffffff',
    minWidth = 0.4,
    maxWidth = 1.6,
    velocityFilterWeight = 0.8,
    minDistance = 3,
    onEnd
  },
  ref
) {
  const innerRef = useRef<SignatureCanvas | null>(null);

  useImperativeHandle(ref, () => ({
    clear: () => innerRef.current?.clear(),
    isEmpty: () => innerRef.current?.isEmpty() ?? true,
    toDataUrl: () => innerRef.current?.toDataURL('image/png') ?? '',
    fromDataUrl: (dataUrl: string) => innerRef.current?.fromDataURL(dataUrl)
  }));

  return (
    <div className={cn('w-full rounded-md border', className)} style={{ backgroundColor }}>
      <SignatureCanvas
        ref={innerRef}
        penColor={penColor}
        backgroundColor={backgroundColor}
        minWidth={minWidth}
        maxWidth={maxWidth}
        velocityFilterWeight={velocityFilterWeight}
        minDistance={minDistance}
        canvasProps={{ width, height, className: 'w-full', style: { height } }}
        onEnd={() => onEnd?.(innerRef.current?.isEmpty() ?? true)}
      />
    </div>
  );
});
