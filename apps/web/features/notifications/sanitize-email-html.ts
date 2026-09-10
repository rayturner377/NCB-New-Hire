/**
 * Applied to every template body on save, regardless of which editor mode
 * wrote it (see update-template.ts) — the NCB Email Design Style Guide
 * requires zero clickable links in outgoing mail. Text mode's rich-text
 * editor already can't produce a real `<a>` (no Link extension registered —
 * see rich-text-editor.tsx), but Code mode lets an admin paste arbitrary
 * HTML directly, so this is the actual enforcement point for that rule now,
 * not just an editor-affordance omission.
 *
 * Regex-based rather than a full HTML parser/sanitizer library — acceptable
 * here specifically because the input is always admin-authored through
 * Settings → Templates (the same trust level already documented on
 * NotificationEmail's own `bodyHtml` prop), never end-user input. This is a
 * guardrail against an admin accidentally pasting something non-compliant
 * (a signature block with a link, a snippet with an onclick handler), not a
 * defense against a deliberately adversarial author. If templates ever
 * accept untrusted input, replace this with a real sanitizer.
 */
export function sanitizeEmailHtml(html: string): string {
  let output = html;

  // Script/iframe/object/embed: removed entirely, including their content — no legitimate
  // reason for any of these in a notification email body.
  output = output.replace(/<(script|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  output = output.replace(/<(script|iframe|object|embed)\b[^>]*\/?>/gi, '');

  // Anchors: unwrapped rather than removed outright, so the visible link text an admin typed
  // (e.g. "contact support") survives — only the clickable tag itself goes.
  output = output.replace(/<a\b[^>]*>/gi, '').replace(/<\/a>/gi, '');

  // Inline event-handler attributes (onclick=, onerror=, ...) and javascript: URIs on whatever
  // tags remain.
  output = output.replace(/\son\w+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, '');
  output = output.replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1=$2#$2');

  return output;
}
