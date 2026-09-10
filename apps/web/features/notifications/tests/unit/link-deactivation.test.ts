import { describe, expect, it } from 'vitest';
import { deactivateIfLinklike } from '../../link-deactivation';

describe('deactivateIfLinklike', () => {
  it('leaves an ordinary value untouched', () => {
    expect(deactivateIfLinklike('Jane Doe')).toBe('Jane Doe');
  });

  it('wraps a URL in a letter-spaced, non-breaking-space-separated span so email clients cannot autolink it', () => {
    const result = deactivateIfLinklike('www.jncb.com');
    expect(result).toBe('<span style="letter-spacing:-2px">w&nbsp;w&nbsp;w&nbsp;.&nbsp;j&nbsp;n&nbsp;c&nbsp;b&nbsp;.&nbsp;c&nbsp;o&nbsp;m</span>');
  });

  it('wraps an https:// URL the same way', () => {
    const result = deactivateIfLinklike('https://jncb.com/app');
    expect(result.startsWith('<span style="letter-spacing:-2px">')).toBe(true);
    expect(result).not.toContain('<a ');
  });

  it('inserts a word-joiner inside a phone number rather than letter-spacing it', () => {
    const result = deactivateIfLinklike('888-622-3477');
    expect(result).toContain('&#8288;');
    expect(result).not.toContain('letter-spacing');
    // Stripping the word-joiner recovers the original digits exactly.
    expect(result.replace('&#8288;', '')).toBe('888-622-3477');
  });

  it('does not treat a relative path as link-like (nothing to autolink)', () => {
    expect(deactivateIfLinklike('/login')).toBe('/login');
  });
});
