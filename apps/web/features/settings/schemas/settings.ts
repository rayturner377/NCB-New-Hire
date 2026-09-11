import { z } from 'zod';
import { parseAndValidateImageDataUrl } from '../../../lib/image-data-url';
import { SLA_EVENT_KEYS, isValidEventOrder } from '../sla-events';

/**
 * A logo upload is stored inline as a data URL (see settings-service.ts) —
 * bounded well under what a Postgres TOAST-able bytea handles comfortably
 * once JSON-stringified and encrypted alongside the rest of the settings
 * envelope. next.config.mjs's serverActions.bodySizeLimit is raised to
 * match — two of these in the same submission would otherwise still hit
 * that request-level cap even with a roomy per-field limit here.
 *
 * The real size/content enforcement is byte-level, via
 * parseAndValidateImageDataUrl (decoded bytes against MAX_LOGO_IMAGE_BYTES,
 * checked against actual PNG/JPEG/WebP magic bytes or, for SVG, a real
 * content-safety check rather than trusting the declared type — see that
 * module) — MAX_LOGO_DATA_URL_LENGTH here is just a generous outer cap on
 * the base64 string itself, before bothering to decode it at all.
 */
const MAX_LOGO_DATA_URL_LENGTH = 3_000_000;
const MAX_LOGO_IMAGE_BYTES = 2 * 1024 * 1024;
const logoDataUrlSchema = z.string().max(MAX_LOGO_DATA_URL_LENGTH, 'Image is too large — try a smaller file.').superRefine((value, ctx) => {
  if (value === '') return;
  try {
    parseAndValidateImageDataUrl(value, MAX_LOGO_IMAGE_BYTES);
  } catch (error) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: error instanceof Error ? error.message : 'Invalid image.' });
  }
});

export const generalSettingsSchema = z.object({
  organizationName: z.string().trim().min(1, 'Organization name is required').max(200),
  portalName: z.string().trim().min(1, 'Portal name is required').max(200),
  supportContact: z.string().trim().max(200).optional().default(''),
  smallLogoDataUrl: logoDataUrlSchema.optional().default(''),
  largeLogoDataUrl: logoDataUrlSchema.optional().default(''),
  loginImageDataUrl: logoDataUrlSchema.optional().default('')
});

export const notificationSettingsSchema = z.object({
  reviewerNotificationEmail: z.string().trim().max(500).optional().default(''),
  doctorNotificationEmail: z.string().trim().max(500).optional().default('')
});

export const exportSettingsSchema = z.object({
  confidentialityNotice: z.string().trim().max(2000).optional().default(''),
  fileNamePattern: z
    .string()
    .trim()
    .min(1, 'File name pattern is required')
    .max(200)
    .refine((value) => value.includes('{caseId}'), 'Must include {caseId} so exported files stay unique.')
});

export const userPolicySettingsSchema = z.object({
  minPasswordLength: z.coerce.number().int().min(8, 'Must be at least 8').max(64),
  requireUppercase: z.boolean().default(false),
  requireNumber: z.boolean().default(false),
  requireSymbol: z.boolean().default(false),
  sessionTimeoutMinutes: z.coerce.number().int().min(1).max(1440),
  loginMaxAttempts: z.coerce.number().int().min(1).max(50),
  loginWindowMinutes: z.coerce.number().int().min(1).max(1440)
});

export const slaDefinitionSchema = z
  .object({
    key: z
      .string()
      .trim()
      .min(1, 'Required')
      .max(60)
      .regex(/^[a-z0-9_]+$/, 'Lowercase letters, numbers, and underscores only'),
    name: z.string().trim().min(1, 'Name is required').max(200),
    description: z.string().trim().max(500).optional().default(''),
    startEvent: z.enum(SLA_EVENT_KEYS),
    endEvent: z.enum(SLA_EVENT_KEYS),
    targetHours: z.coerce.number().int().min(1, 'Must be at least 1 hour').max(8760),
    warningPercent: z.coerce.number().int().min(1, 'Must be at least 1%').max(99, 'Must be under 100%'),
    enabled: z.boolean().default(true)
  })
  .refine((definition) => isValidEventOrder(definition.startEvent, definition.endEvent), {
    message: 'End milestone must happen after the start milestone in a case’s real lifecycle',
    path: ['endEvent']
  });

export const slaSettingsSchema = z.object({
  definitions: z
    .array(slaDefinitionSchema)
    .refine((definitions) => new Set(definitions.map((definition) => definition.key)).size === definitions.length, {
      message: 'Each SLA policy needs a unique key'
    })
});

export const themeSettingsSchema = z.object({
  mode: z.enum(['light', 'dark']),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color'),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color'),
  dangerColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color')
});

export const mailSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  fromEmail: z
    .string()
    .trim()
    .max(254)
    .optional()
    .default('')
    .refine((value) => value === '' || z.string().email().safeParse(value).success, 'Enter a valid email address'),
  host: z.string().trim().max(255).optional().default(''),
  port: z.coerce.number().int().min(1).max(65535).default(587),
  username: z.string().trim().max(255).optional().default(''),
  password: z.string().max(500).optional().default(''),
  secure: z.boolean().default(false)
});
