import { Body, Container, Head, Html, Img, Preview, Section, Text } from '@react-email/components';
import { EMAIL_BRAND } from '../brand';

export interface NotificationEmailProps {
  previewText: string;
  portalName: string;
  /** Already variable-substituted HTML from the template's own editor (see rich-text-editor.tsx/html-code-editor.tsx/template-editor-page.tsx) — not plain text. Safe to inject directly: it only ever comes from an admin authoring a template through Settings → Templates, sanitized on save regardless of editor mode (see sanitize-email-html.ts) to strip anything the NCB Email Design Style Guide forbids — the same trust level as any other admin-authored content elsewhere in this app, never end-user input. */
  bodyHtml: string;
  logoUrl?: string;
  /**
   * Full HTML for the shared header/footer pieces — each is itself a real
   * template (Settings → Templates → "Header & footer", keys email_header/
   * email_footer), authored and sanitized exactly the same way `bodyHtml` is.
   * Unlike the old plain-text tagline/sign-off fields these replaced, there's
   * no forced background/color/padding wrapping them beyond the logo header's
   * own white band and a little breathing room — an admin who wants the
   * footer's brand-colored look controls it directly with their own inline
   * CSS (see registry.ts's default email_footer body for what that looks
   * like out of the box), not something this component imposes on them.
   */
  headerHtml?: string;
  footerHtml?: string;
  /** Only meaningful alongside footerHtml — a `#rrggbb` value (Settings → Templates → Email footer) wraps it in a colored, padded band. The header and body sections both keep a fixed white background per the guide (the logo must always sit on solid white), so there's no equivalent for those. */
  footerBackgroundColor?: string;
}

/**
 * The one consistent branded shell every notification email renders through
 * — built to the NCB Email Design Style Guide (NCB Financial Group, revised
 * Nov 2023): 600px width, white header holding the logo, Helvetica type on
 * the guide's own color palette (see ../brand.ts — deliberately independent
 * of the portal's own admin-configurable theme). No promotional band — the
 * guide reserves that for marketing email, explicitly excluding "advisory
 * messages, notifications, or other emails categorized as critical
 * communications", which is everything this app sends. The logo itself is
 * always shown (guaranteed brand presence regardless of what an admin writes
 * in the header template); everything else — the header content below it,
 * the main body, and the entire footer — is admin-authored HTML this
 * component doesn't reinterpret or restyle.
 */
export function NotificationEmail({ previewText, portalName, bodyHtml, logoUrl, headerHtml, footerHtml, footerBackgroundColor }: NotificationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={{ backgroundColor: EMAIL_BRAND.panelBackground, fontFamily: EMAIL_BRAND.fontFamily, margin: 0, padding: '24px 12px' }}>
        <Container style={{ backgroundColor: '#ffffff', maxWidth: 600, margin: '0 auto', border: `1px solid ${EMAIL_BRAND.border}` }}>
          {/* Header section — logo always on a solid white background, per the guide. */}
          <Section style={{ backgroundColor: '#ffffff', padding: '18px 32px', borderBottom: `1px solid ${EMAIL_BRAND.border}` }}>
            {logoUrl ? (
              <Img src={logoUrl} alt={portalName} height={35} />
            ) : (
              <Text style={{ fontSize: 18, fontWeight: 700, color: EMAIL_BRAND.primary, margin: 0 }}>{portalName}</Text>
            )}
            {/* The email_header template — fully admin-authored HTML, no forced styling beyond a little top spacing. */}
            {headerHtml ? <div style={{ marginTop: 8 }} dangerouslySetInnerHTML={{ __html: headerHtml }} /> : null}
          </Section>

          <Section style={{ padding: '32px' }}>
            {/* Admin-authored template HTML — standard-paragraph size/color per the guide's type scale; sanitized on save regardless of editor mode (sanitize-email-html.ts), and dynamic {{variable}} values that look like a URL or phone number are separately de-linked before this ever gets here (see link-deactivation.ts). */}
            <div style={{ fontSize: 15, lineHeight: '18px', color: EMAIL_BRAND.bodyText }} dangerouslySetInnerHTML={{ __html: bodyHtml }} />
          </Section>

          {/* The email_footer template — fully admin-authored HTML. footerBackgroundColor (Settings → Templates → Email footer) is the one imposed wrapper in this whole component, since the footer is deliberately the only section without a fixed background — see the type's own doc comment. */}
          {footerHtml ? (
            <div
              style={footerBackgroundColor ? { backgroundColor: footerBackgroundColor, padding: '20px 32px' } : undefined}
              dangerouslySetInnerHTML={{ __html: footerHtml }}
            />
          ) : null}
        </Container>
      </Body>
    </Html>
  );
}
