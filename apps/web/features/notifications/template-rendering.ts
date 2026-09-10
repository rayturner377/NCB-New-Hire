import { deactivateIfLinklike } from './link-deactivation';

/** Plain `{{variable}}` substitution — used for subject lines, which are never HTML and so never need link de-activation (a `<span>` there would show up as literal text). */
export function substituteVariables(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, name: string) => variables[name] ?? match);
}

/**
 * Same substitution, for the HTML body — a variable whose value looks like
 * a URL or phone number (e.g. {{loginUrl}}) comes back de-linked per the
 * NCB Email Design Style Guide (see link-deactivation.ts). Framework-
 * agnostic (no server-only imports) so both notification-service.ts (the
 * real send path) and email-preview.tsx (the Templates editor's live
 * preview, running in the browser) apply the exact same behavior — an
 * admin previewing a template sees precisely how {{loginUrl}} will actually
 * render, de-activated link and all, not a raw placeholder.
 */
export function substituteBodyVariables(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, name: string) => {
    const value = variables[name];
    return value === undefined ? match : deactivateIfLinklike(value);
  });
}
