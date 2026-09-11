import { describe, expect, it } from 'vitest';
import { parseAndValidateImageDataUrl } from '../../image-data-url';

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const WEBP_BYTES = Buffer.concat([Buffer.from('RIFF', 'ascii'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP', 'ascii')]);

function dataUrl(declaredMimeType: string, bytes: Buffer): string {
  return `data:${declaredMimeType};base64,${bytes.toString('base64')}`;
}

describe('parseAndValidateImageDataUrl', () => {
  it('accepts a real PNG and reports the sniffed type', () => {
    const result = parseAndValidateImageDataUrl(dataUrl('image/png', PNG_BYTES), 1024 * 1024);
    expect(result.mimeType).toBe('image/png');
  });

  it('accepts a real JPEG', () => {
    const result = parseAndValidateImageDataUrl(dataUrl('image/jpeg', JPEG_BYTES), 1024 * 1024);
    expect(result.mimeType).toBe('image/jpeg');
  });

  it('accepts a real WebP', () => {
    const result = parseAndValidateImageDataUrl(dataUrl('image/webp', WEBP_BYTES), 1024 * 1024);
    expect(result.mimeType).toBe('image/webp');
  });

  it('sniffs by actual content, not the declared prefix — a mislabeled PNG is still detected as PNG', () => {
    const result = parseAndValidateImageDataUrl(dataUrl('image/gif', PNG_BYTES), 1024 * 1024);
    expect(result.mimeType).toBe('image/png');
  });

  it('rejects content that is not any known image signature (e.g. plain text claiming to be an image)', () => {
    const fakeBytes = Buffer.from('this is not image data at all', 'ascii');
    expect(() => parseAndValidateImageDataUrl(dataUrl('image/png', fakeBytes), 1024 * 1024)).toThrow();
  });

  it('accepts a safe SVG (a real <svg> root, no script/event-handler content)', () => {
    const svgText = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>', 'ascii');
    const result = parseAndValidateImageDataUrl(dataUrl('image/svg+xml', svgText), 1024 * 1024);
    expect(result.mimeType).toBe('image/svg+xml');
  });

  it('rejects an SVG containing a <script> tag', () => {
    const svgText = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', 'ascii');
    expect(() => parseAndValidateImageDataUrl(dataUrl('image/svg+xml', svgText), 1024 * 1024)).toThrow();
  });

  it('rejects an SVG containing an inline event-handler attribute', () => {
    const svgText = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><circle cx="5" cy="5" r="4"/></svg>', 'ascii');
    expect(() => parseAndValidateImageDataUrl(dataUrl('image/svg+xml', svgText), 1024 * 1024)).toThrow();
  });

  it('rejects text that merely mentions "svg" without a real <svg> root element', () => {
    const notSvg = Buffer.from('this text just happens to mention svg somewhere in it', 'ascii');
    expect(() => parseAndValidateImageDataUrl(dataUrl('image/svg+xml', notSvg), 1024 * 1024)).toThrow();
  });

  it('rejects a value that is not a data URL at all', () => {
    expect(() => parseAndValidateImageDataUrl('https://example.com/logo.png', 1024 * 1024)).toThrow();
  });

  it('rejects decoded content over the given byte limit', () => {
    const oversized = Buffer.concat([PNG_BYTES, Buffer.alloc(2000)]);
    expect(() => parseAndValidateImageDataUrl(dataUrl('image/png', oversized), 1000)).toThrow();
  });

  it('rejects an empty payload', () => {
    expect(() => parseAndValidateImageDataUrl('data:image/png;base64,', 1024 * 1024)).toThrow();
  });
});
