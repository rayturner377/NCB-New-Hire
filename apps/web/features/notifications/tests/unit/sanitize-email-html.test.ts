import { describe, expect, it } from 'vitest';
import { sanitizeEmailHtml } from '../../sanitize-email-html';

describe('sanitizeEmailHtml', () => {
  it('unwraps anchor tags but keeps their visible text', () => {
    expect(sanitizeEmailHtml('<p>Contact <a href="https://ncb.com">support</a> for help.</p>')).toBe(
      '<p>Contact support for help.</p>'
    );
  });

  it('removes script tags entirely, including their content', () => {
    expect(sanitizeEmailHtml('<p>Hi</p><script>alert("x")</script>')).toBe('<p>Hi</p>');
  });

  it('removes iframe/object/embed tags entirely', () => {
    expect(sanitizeEmailHtml('<iframe src="https://evil.com"></iframe><p>Body</p>')).toBe('<p>Body</p>');
    expect(sanitizeEmailHtml('<object data="x.swf"></object><p>Body</p>')).toBe('<p>Body</p>');
    expect(sanitizeEmailHtml('<embed src="x.swf" /><p>Body</p>')).toBe('<p>Body</p>');
  });

  it('strips inline event-handler attributes', () => {
    expect(sanitizeEmailHtml('<p onclick="doBad()">Click me</p>')).toBe('<p>Click me</p>');
    expect(sanitizeEmailHtml("<img src='x.png' onerror='doBad()' />")).toBe("<img src='x.png' />");
  });

  it('neutralizes javascript: URIs left on remaining tags', () => {
    expect(sanitizeEmailHtml('<img src="javascript:alert(1)" />')).toBe('<img src="#" />');
  });

  it('leaves ordinary formatted HTML with embedded CSS untouched', () => {
    const html = '<div style="color:#005baa;font-weight:bold"><p>Hello {{recipientName}}</p><table><tr><td>Cell</td></tr></table></div>';
    expect(sanitizeEmailHtml(html)).toBe(html);
  });
});
