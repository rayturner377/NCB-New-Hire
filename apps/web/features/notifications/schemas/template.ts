import { z } from 'zod';
import { NOTIFICATION_TEMPLATES } from '../registry';

const TEMPLATE_KEYS = NOTIFICATION_TEMPLATES.map((template) => template.key) as [string, ...string[]];

export const updateTemplateSchema = z.object({
  key: z.enum(TEMPLATE_KEYS),
  subject: z.string().trim().min(1, 'Subject is required').max(500),
  /** HTML from either editor mode (see rich-text-editor.tsx / html-code-editor.tsx) — not plain text, so this is deliberately a generous cap rather than a "reasonable sentence length" one. */
  body: z.string().trim().min(1, 'Message is required').max(20000),
  /** Which editor authored `body` — decides which one template-editor-page.tsx re-opens into. */
  bodyMode: z.enum(['text', 'code']).default('text'),
  ccEmails: z.string().trim().max(1000).optional().default(''),
  bccEmails: z.string().trim().max(1000).optional().default(''),
  /** Only meaningful for email_footer — see template-editor-page.tsx's background-color control. A strict `#rrggbb` pattern (or empty, meaning "no color") since this is written straight into a `style` attribute (notification-email.tsx/email-preview.tsx), not run through the HTML sanitizer. */
  backgroundColor: z
    .union([z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a #rrggbb color'), z.literal('')])
    .optional()
    .default(''),
  enabled: z.boolean().default(true)
});
