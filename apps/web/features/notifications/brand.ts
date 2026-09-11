/**
 * Fixed colors/type from the NCB Email Design Style Guide (NCB Financial
 * Group, revised Nov 2023) — deliberately NOT the admin-configurable
 * Settings → Theme colors, which only skin the web portal's own UI
 * (buttons, links inside the app). The guide is explicit that its palette
 * "should [not be] alter[ed] or introduc[ed with] colors beyond the
 * designated spectrum" for outgoing brand communications, so an
 * organization's chosen in-app button color has no bearing on what an
 * actual sent email looks like — every notification renders with this
 * fixed palette regardless of the portal's own theme settings.
 */
export const EMAIL_BRAND = {
  /** NCB Jamaica primary blue — the guide's own #005baa, used for headline/link-style text and the footer band. */
  primary: '#005baa',
  /** NCBFG cyan accent — the guide's #00aeef. */
  accent: '#00aeef',
  /** "Blue Level 1" background tint from the guide's email background palette. */
  panelBackground: '#f2faff',
  /** "Blue Level 2" — a subtle border/divider tone from the same palette. */
  border: '#e2f2fc',
  /** Standard paragraph text color specified in the guide's typography section. */
  bodyText: '#666666',
  /** "Black 90%" — the guide's darkest neutral, for anything needing more contrast than standard body text. */
  darkText: '#414042',
  footerBackground: '#005baa',
  footerText: '#ffffff',
  /** The guide's required font stack (Helvetica, falling back to Arial then sans-serif). */
  fontFamily: 'Helvetica, Arial, sans-serif'
} as const;
