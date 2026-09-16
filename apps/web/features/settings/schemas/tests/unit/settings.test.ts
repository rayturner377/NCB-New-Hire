import { describe, expect, it } from 'vitest';
import { generalSettingsSchema } from '../../settings';

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);

function pngDataUrl(): string {
  return `data:image/png;base64,${PNG_BYTES.toString('base64')}`;
}

function baseFields(overrides: Record<string, string> = {}) {
  return {
    organizationName: 'NCB',
    portalName: 'NCB Medical Platform',
    supportContact: '',
    smallLogoDataUrl: '',
    largeLogoDataUrl: '',
    ...overrides
  };
}

describe('generalSettingsSchema logo validation', () => {
  it('accepts an empty logo (no logo uploaded)', () => {
    const result = generalSettingsSchema.safeParse(baseFields());
    expect(result.success).toBe(true);
  });

  it('accepts a real PNG data URL', () => {
    const result = generalSettingsSchema.safeParse(baseFields({ smallLogoDataUrl: pngDataUrl() }));
    expect(result.success).toBe(true);
  });

  it('rejects a value that merely claims to be an image without real image bytes', () => {
    const fakeDataUrl = `data:image/png;base64,${Buffer.from('not actually a png').toString('base64')}`;
    const result = generalSettingsSchema.safeParse(baseFields({ smallLogoDataUrl: fakeDataUrl }));
    expect(result.success).toBe(false);
  });

  it('accepts a safe SVG logo', () => {
    const svgDataUrl = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><circle r="4"/></svg>').toString('base64')}`;
    const result = generalSettingsSchema.safeParse(baseFields({ largeLogoDataUrl: svgDataUrl }));
    expect(result.success).toBe(true);
  });

  it('rejects an SVG logo containing a script tag, even though the old check only looked at the declared prefix', () => {
    const svgDataUrl = `data:image/svg+xml;base64,${Buffer.from('<svg><script>alert(1)</script></svg>').toString('base64')}`;
    const result = generalSettingsSchema.safeParse(baseFields({ largeLogoDataUrl: svgDataUrl }));
    expect(result.success).toBe(false);
  });

  it('rejects a plain non-data-URL string', () => {
    const result = generalSettingsSchema.safeParse(baseFields({ smallLogoDataUrl: 'not-a-data-url' }));
    expect(result.success).toBe(false);
  });
});

describe('generalSettingsSchema login image URL mode', () => {
  it('accepts an empty loginImageUrl and defaults loginImageMode to upload', () => {
    const result = generalSettingsSchema.safeParse(baseFields());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.loginImageUrl).toBe('');
      expect(result.data.loginImageMode).toBe('upload');
    }
  });

  it('accepts a real http(s) URL', () => {
    const result = generalSettingsSchema.safeParse(baseFields({ loginImageUrl: 'https://example.com/photo.jpg', loginImageMode: 'url' }));
    expect(result.success).toBe(true);
  });

  it('rejects a non-http(s) value (e.g. a data: or javascript: URL)', () => {
    const result = generalSettingsSchema.safeParse(baseFields({ loginImageUrl: 'javascript:alert(1)' }));
    expect(result.success).toBe(false);
  });

  it('rejects an unrecognized loginImageMode', () => {
    const result = generalSettingsSchema.safeParse(baseFields({ loginImageMode: 'ftp' }));
    expect(result.success).toBe(false);
  });
});
