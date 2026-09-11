import { EMAIL_BRAND } from '../brand';

export interface EmailPreviewBranding {
  portalName: string;
  organizationName: string;
  logoUrl?: string;
}

export interface EmailPreviewProps {
  subject: string;
  bodyHtml: string;
  /** Already variable-substituted HTML for the header (below the logo) and footer — see NotificationEmail's own props for why these carry no forced styling of their own. */
  headerHtml?: string;
  footerHtml?: string;
  /** Mirrors NotificationEmail's own prop of the same name — see its doc comment for why the footer is the one section this applies to. */
  footerBackgroundColor?: string;
  branding: EmailPreviewBranding;
}

/**
 * A client-side approximation of NotificationEmail (features/notifications/
 * emails/notification-email.tsx) — that component renders through
 * @react-email/render, which only runs in Node, so it can't re-render live
 * on every keystroke here. This mirrors its NCB Email Design Style Guide
 * layout (600px width, white header, Helvetica type) closely enough for
 * "does my formatting look right" purposes; the actual send always goes
 * through the real component, so this never needs to be pixel-perfect.
 */
export function EmailPreview({ subject, bodyHtml, headerHtml, footerHtml, footerBackgroundColor, branding }: EmailPreviewProps) {
  const doc = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { background: ${EMAIL_BRAND.panelBackground}; font-family: ${EMAIL_BRAND.fontFamily}; margin: 0; padding: 24px 12px; }
  .container { background: #ffffff; max-width: 600px; margin: 0 auto; border: 1px solid ${EMAIL_BRAND.border}; }
  .header { background: #ffffff; padding: 18px 32px; border-bottom: 1px solid ${EMAIL_BRAND.border}; }
  .brand { font-size: 18px; font-weight: 700; color: ${EMAIL_BRAND.primary}; margin: 0; }
  .header-content { margin-top: 8px; }
  .content { padding: 32px; }
  .body { font-size: 15px; line-height: 18px; color: ${EMAIL_BRAND.bodyText}; }
  .body p { margin: 0 0 12px; }
  /* A blank line (pressing Enter twice) produces a genuinely empty <p></p> — with no content and only
     margin, browsers collapse it to zero visible height, making the blank line invisible here even
     though it's really in the HTML. Forcing a min-height keeps it visible, matching what an admin
     actually typed. */
  .body p:empty { min-height: 1em; }
  .body h2 { font-size: 18px; margin: 16px 0 8px; }
  .body h3 { font-size: 15px; margin: 14px 0 6px; }
  .body ul, .body ol { margin: 0 0 12px; padding-left: 20px; }
  .body blockquote { margin: 0 0 12px; padding-left: 12px; border-left: 3px solid ${EMAIL_BRAND.border}; color: ${EMAIL_BRAND.bodyText}; }
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      ${branding.logoUrl ? `<img src="${branding.logoUrl}" alt="${branding.portalName}" height="35" />` : `<p class="brand">${branding.portalName}</p>`}
      ${headerHtml ? `<div class="header-content">${headerHtml}</div>` : ''}
    </div>
    <div class="content">
      <div class="body">${bodyHtml || '<p style="color:#9ca3af">Nothing written yet…</p>'}</div>
    </div>
    ${footerHtml ? (footerBackgroundColor ? `<div style="background-color:${footerBackgroundColor};padding:20px 32px">${footerHtml}</div>` : footerHtml) : ''}
  </div>
</body>
</html>`;

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-md border bg-muted px-3 py-2 text-xs">
        <span className="font-semibold">Subject: </span>
        {subject || <span className="text-muted-foreground">(empty)</span>}
      </div>
      <iframe title="Email preview" srcDoc={doc} sandbox="" className="h-[560px] w-full rounded-md border bg-white" />
    </div>
  );
}
