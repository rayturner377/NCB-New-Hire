export interface InlineImageAttachment {
  cid: string;
  content: Buffer;
  contentType: string;
}

export interface InlinedHtml {
  html: string;
  attachments: InlineImageAttachment[];
}

const DATA_URL_IMG_SRC = /src="data:([^;"]+);base64,([^"]+)"/g;

/**
 * Swaps base64 data-URI image sources for `cid:` references with matching nodemailer attachments
 * — most real email clients (Outlook desktop, Gmail, Yahoo) strip or block inline base64 images
 * entirely, so a logo embedded this way (settings.general.smallLogoDataUrl, rendered straight into
 * an <img src="data:..."> by NotificationEmail) silently fails to show up in an actual inbox even
 * though it renders fine anywhere a browser draws the HTML directly — the in-app live preview, or
 * the Message Centre's own detail view. CID embedding is the one image-delivery method every major
 * client supports, so this is applied right before the real SMTP send (mail.ts's sendMail callers)
 * — never to what's stored in email_messages.body_html, which keeps its original data URI so it
 * still renders correctly wherever it's viewed in-app, and so a later Resend can run this same
 * transform again.
 *
 * SVG data URIs are left untouched rather than converted — SVG has essentially no support across
 * real email clients either way (Outlook in particular won't render it as a cid attachment any
 * more than it renders the raw data URI), and turning one into an attachment just adds a visible
 * "attachment-N.svg" alongside the still-broken inline image instead of only the latter.
 */
export function inlineDataUrlImages(html: string): InlinedHtml {
  const attachments: InlineImageAttachment[] = [];
  let index = 0;

  const inlinedHtml = html.replace(DATA_URL_IMG_SRC, (match, contentType: string, base64: string) => {
    if (contentType === 'image/svg+xml') return match;
    index += 1;
    const cid = `inline-image-${index}@ncb`;
    attachments.push({ cid, content: Buffer.from(base64, 'base64'), contentType });
    return `src="cid:${cid}"`;
  });

  return { html: inlinedHtml, attachments };
}
