import type { SlaEventKey } from './sla-events';

/**
 * One admin-defined SLA policy — "how long is it allowed to take to get from
 * this milestone to that one". Not a fixed set: an admin can add as many of
 * these as needed (see sla-settings-form.tsx), each measuring between any two
 * of the fixed milestones in sla-events.ts's SLA_EVENT_POINTS.
 */
export interface SlaDefinition {
  /** Stable slug so a policy can be renamed without losing its stored config — generated once from the name when first created, never re-derived from it afterward. */
  key: string;
  name: string;
  description?: string;
  startEvent: SlaEventKey;
  endEvent: SlaEventKey;
  targetHours: number;
  /** Percentage of targetHours elapsed at which a still-open policy flips from "on track" to "at risk" — an early warning before it actually breaches. */
  warningPercent: number;
  enabled: boolean;
}

/**
 * The shared email header/footer used to live here as plain-text fields
 * (`emailBranding`) — they're now full HTML templates in their own right
 * (registry.ts's email_header/email_footer, same notification_templates
 * table and Text/Code editor every other template uses), so an admin gets
 * real HTML/inline-CSS control over them instead of a single wording field.
 * See features/notifications/services/templates-service.ts's
 * listStructuralTemplateViews.
 */
export interface AppSettings {
  general: {
    organizationName: string;
    portalName: string;
    supportContact: string;
    /** Data URLs (see logo-upload-field.tsx) — small square mark for the topbar, larger mark for the login screen. */
    smallLogoDataUrl: string;
    largeLogoDataUrl: string;
    /** The right-hand panel image on the login screen (see components/layout/auth-layout.tsx's `imageSrc`) — purely decorative/branding, distinct from the logos above. Uploading a new one replaces this field outright; there's no history of past images kept anywhere. */
    loginImageDataUrl: string;
    /** The same login-screen image, but hosted elsewhere and referenced by URL instead of uploaded inline — an admin picks which of the two is actually shown via `loginImageMode` (see login-image-field.tsx). Kept as its own field, separate from loginImageDataUrl, specifically so switching modes back and forth never loses whichever one isn't currently active. */
    loginImageUrl: string;
    /** Which of loginImageDataUrl / loginImageUrl is the one actually rendered on the login screen (see login/page.tsx). */
    loginImageMode: 'upload' | 'url';
  };
  notifications: {
    /** "To" address for notifications with no single case-specific recipient (a doctor submitting an assessment — there's no one "assigned reviewer" to send it to). */
    reviewerNotificationEmail: string;
    /** CC'd on every doctor-directed notification, in addition to the actual assigned doctor's own email — an admin inbox copy, not the sole recipient. */
    doctorNotificationEmail: string;
  };
  export: {
    confidentialityNotice: string;
    fileNamePattern: string;
  };
  userPolicy: {
    minPasswordLength: number;
    requireUppercase: boolean;
    requireNumber: boolean;
    requireSymbol: boolean;
    sessionTimeoutMinutes: number;
    loginMaxAttempts: number;
    loginWindowMinutes: number;
    /** The new-device emailed-code challenge (see packages/auth/src/index.ts's twoFactor() plugin) — @default true. This is the break-glass switch: since every account's AppUser.twoFactorEnabled is the actual thing Better Auth checks, turning this off bulk-updates that column to false for every account (see updateUserPolicySettingsAction), and back to true when re-enabled. Only meant for "outbound email is broken and everyone is locked out" — not a routine setting to toggle. */
    requireDeviceVerification: boolean;
  };
  sla: {
    definitions: SlaDefinition[];
  };
  theme: {
    mode: 'light' | 'dark';
    primaryColor: string;
    accentColor: string;
    dangerColor: string;
  };
  mail: {
    enabled: boolean;
    fromEmail: string;
    host: string;
    port: number;
    username: string;
    password: string;
    secure: boolean;
  };
}

/**
 * Seeded starter policies covering the three turnaround times HR actually
 * manages a case against day to day — an admin can edit, disable, delete, or
 * add to these freely from Settings → SLA (sla-settings-form.tsx); nothing
 * here is hardcoded into the computation engine (see cases/sla.ts), only
 * shipped as sensible defaults for a first-run system.
 */
export const DEFAULT_SLA_DEFINITIONS: SlaDefinition[] = [
  {
    key: 'doctor_review_turnaround',
    name: 'Doctor submission to HR review',
    description: "How long HR has to review a case once the doctor's assessment lands.",
    startEvent: 'doctor_submitted',
    endEvent: 'hr_reviewed',
    targetHours: 48,
    warningPercent: 80,
    enabled: true
  },
  {
    key: 'payment_after_review',
    name: 'HR review to doctor payment',
    description: 'How long it should take to pay the doctor once HR has signed off.',
    startEvent: 'hr_reviewed',
    endEvent: 'payment_confirmed',
    targetHours: 120,
    warningPercent: 80,
    enabled: true
  },
  {
    key: 'end_to_end',
    name: 'Assignment to payment (end-to-end)',
    description: 'The full turnaround for a case, from the moment a doctor is assigned to the moment they get paid.',
    startEvent: 'assigned',
    endEvent: 'payment_confirmed',
    targetHours: 336,
    warningPercent: 80,
    enabled: true
  }
];

export const DEFAULT_SETTINGS: AppSettings = {
  general: {
    organizationName: 'National Commercial Bank Jamaica Limited',
    portalName: 'NCB Medical Platform',
    supportContact: '',
    smallLogoDataUrl: '',
    largeLogoDataUrl: '',
    loginImageDataUrl: '',
    loginImageUrl: '',
    loginImageMode: 'upload'
  },
  notifications: {
    reviewerNotificationEmail: '',
    doctorNotificationEmail: ''
  },
  export: {
    confidentialityNotice: 'This document contains confidential medical information intended solely for the use of the named recipient.',
    fileNamePattern: 'medical-assessment-{caseId}'
  },
  userPolicy: {
    minPasswordLength: 12,
    requireUppercase: false,
    requireNumber: false,
    requireSymbol: false,
    sessionTimeoutMinutes: 15,
    loginMaxAttempts: 5,
    loginWindowMinutes: 15,
    requireDeviceVerification: true
  },
  sla: {
    definitions: DEFAULT_SLA_DEFINITIONS
  },
  theme: {
    mode: 'light',
    primaryColor: '#003876',
    accentColor: '#e2e8f0',
    dangerColor: '#dc2626'
  },
  mail: {
    enabled: false,
    fromEmail: '',
    host: '',
    port: 587,
    username: '',
    password: '',
    secure: false
  }
};

/** Deep-merges a possibly-partial stored settings object over the defaults, so adding a new field here never breaks existing saved settings (they just get the default for anything they don't have yet). */
export function mergeWithDefaults(stored: Partial<AppSettings> | null): AppSettings {
  if (!stored) return DEFAULT_SETTINGS;
  return {
    general: { ...DEFAULT_SETTINGS.general, ...stored.general },
    notifications: { ...DEFAULT_SETTINGS.notifications, ...stored.notifications },
    export: { ...DEFAULT_SETTINGS.export, ...stored.export },
    userPolicy: { ...DEFAULT_SETTINGS.userPolicy, ...stored.userPolicy },
    sla: { definitions: stored.sla?.definitions?.length ? stored.sla.definitions : DEFAULT_SETTINGS.sla.definitions },
    theme: { ...DEFAULT_SETTINGS.theme, ...stored.theme },
    mail: { ...DEFAULT_SETTINGS.mail, ...stored.mail }
  };
}

/** Public branding/theme and password requirements for the login screen. Never includes mail credentials or other private settings. */
export function publicSettings(settings: AppSettings) {
  return {
    general: settings.general,
    passwordPolicy: {
      minPasswordLength: settings.userPolicy.minPasswordLength,
      requireUppercase: settings.userPolicy.requireUppercase,
      requireNumber: settings.userPolicy.requireNumber,
      requireSymbol: settings.userPolicy.requireSymbol
    },
    theme: settings.theme
  };
}
