/**
 * The NCB Email Design Style Guide requires every outgoing email to have no
 * clickable hyperlinks or QR codes — a URL or phone number is shown as
 * plain, inert text, deliberately broken so an email client's own "auto-
 * detect and linkify" behavior doesn't turn it into a tappable link anyway.
 * The guide documents two specific techniques, reproduced here exactly:
 *
 *  - URLs: wrap in an inline letter-spacing span with a non-breaking space
 *    between every character (its own worked example renders
 *    "w w w . j n c b . c o m" at `letter-spacing: -2px`, the guide's
 *    prescribed adjustment value for 15px standard body text).
 *  - Phone numbers: insert one Word-Joiner (`&#8288;`) partway through the
 *    digits so the string no longer matches a phone-number autolink
 *    pattern, without changing how it visually reads.
 *
 * Applied only to the *substituted value* of a `{{variable}}` (see
 * notification-service.ts's substituteVariables), never to the surrounding
 * admin-authored template HTML — templates can't contain a real link at all
 * (the rich-text editor has no link tool, see rich-text-editor.tsx), so the
 * only place a link-shaped or phone-shaped string can still enter an email
 * is through a variable like {{loginUrl}}.
 */
const URL_TEST = /(?:https?:\/\/|www\.)[^\s<>"']+|\b[a-z0-9-]+\.(?:com|org|net|jm|co)(?:\/[^\s<>"']*)?/i;
const PHONE_TEST = /\b\d{3}[-.\s]?\d{3,4}[-.\s]?\d{4}\b|\(\d{3}\)\s?\d{3}[-.\s]?\d{4}/;

function letterSpacedSpan(value: string): string {
  const spaced = value.split('').join('&nbsp;');
  return `<span style="letter-spacing:-2px">${spaced}</span>`;
}

function wordJoined(value: string): string {
  const mid = Math.floor(value.length / 2);
  return `${value.slice(0, mid)}&#8288;${value.slice(mid)}`;
}

/** Returns `value` unchanged unless it looks like a URL or phone number, in which case it comes back de-linked using the guide's own technique for that shape. */
export function deactivateIfLinklike(value: string): string {
  if (URL_TEST.test(value)) return letterSpacedSpan(value);
  if (PHONE_TEST.test(value)) return wordJoined(value);
  return value;
}
