/**
 * Real content verification for an image submitted as a `data:` URL (logo
 * uploads, signature captures) — the previous checks across the app only
 * looked at the declared `data:image/...` prefix, which is just a string an
 * attacker (or a mislabeled file) fully controls. This decodes the base64
 * payload and checks the decoded bytes' own signature, the same technique a
 * real file-type sniffer uses, rather than trusting what the client claims
 * the content is.
 *
 * PNG/JPEG/WebP are verified by magic-byte signature. SVG has no such fixed
 * binary signature (it's XML text), so it's verified differently: parsed as
 * text and checked for a real `<svg` root plus the absence of `<script>`,
 * inline event-handler attributes, `javascript:` URIs, or `<foreignObject>`
 * — the constructs that would let an SVG execute script if it were ever
 * rendered somewhere other than a plain `<img src>` (which sandboxes script
 * execution per spec, but that's not a guarantee worth depending on alone).
 * Sniffing is content-first, not label-first: a raster file mislabeled as
 * SVG still gets caught by the raster signature checks running first, and a
 * text payload only falls through to the SVG check once none of those match.
 */
export interface ParsedImageDataUrl {
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/svg+xml';
  bytes: Buffer;
}

interface RasterSignature {
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  matches: (bytes: Buffer) => boolean;
}

const RASTER_SIGNATURES: RasterSignature[] = [
  {
    mimeType: 'image/png',
    matches: (bytes) =>
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
  },
  {
    mimeType: 'image/jpeg',
    matches: (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  },
  {
    mimeType: 'image/webp',
    matches: (bytes) =>
      bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  }
];

const SVG_ROOT_PATTERN = /<svg[\s>]/i;
const SVG_DANGEROUS_PATTERN = /<script[\s>]|on\w+\s*=|javascript:|<foreignobject[\s>]/i;

function isSafeSvg(text: string): boolean {
  return SVG_ROOT_PATTERN.test(text) && !SVG_DANGEROUS_PATTERN.test(text);
}

const DATA_URL_PATTERN = /^data:[a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+;base64,([a-zA-Z0-9+/]+=*)$/;

/**
 * Decodes and validates an image `data:` URL, throwing a user-facing message
 * on any failure. Returns the sniffed (not declared) mime type and the
 * decoded bytes so a caller that needs them (none currently do) doesn't have
 * to re-decode.
 */
/**
 * Cheap prefix check (not a full re-validation) for deciding whether an already-validated logo
 * data URL is safe to embed as an actual `<img>` in a sent email. SVG has essentially no support
 * across real email clients — Outlook in particular doesn't rasterize it at all, showing a broken
 * image with the raw .svg as an attachment (see notification-service.ts's renderNotificationEmail)
 * — even though it renders fine anywhere a browser draws the HTML directly (the topbar, the login
 * screen, the in-app template preview).
 */
export function isSvgDataUrl(value: string): boolean {
  return value.startsWith('data:image/svg+xml');
}

export function parseAndValidateImageDataUrl(value: string, maxBytes: number): ParsedImageDataUrl {
  const match = DATA_URL_PATTERN.exec(value);
  if (!match) {
    throw new Error('Must be an image file.');
  }

  const bytes = Buffer.from(match[1]!, 'base64');
  if (bytes.byteLength === 0) {
    throw new Error('That image is empty.');
  }
  if (bytes.byteLength > maxBytes) {
    throw new Error(`That image is larger than the ${Math.round(maxBytes / (1024 * 1024))}MB limit.`);
  }

  const rasterSignature = RASTER_SIGNATURES.find((candidate) => candidate.matches(bytes));
  if (rasterSignature) {
    return { mimeType: rasterSignature.mimeType, bytes };
  }

  if (isSafeSvg(bytes.toString('utf8'))) {
    return { mimeType: 'image/svg+xml', bytes };
  }

  throw new Error('That does not appear to be a valid PNG, JPEG, WebP, or SVG image.');
}
