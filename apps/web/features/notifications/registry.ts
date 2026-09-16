import { EMAIL_BRAND } from './brand';

export interface NotificationVariable {
  name: string;
  description: string;
}

export interface NotificationTemplateDefinition {
  key: string;
  label: string;
  description: string;
  defaultSubject: string;
  defaultBody: string;
  variables: NotificationVariable[];
  /**
   * True for the two shared wrapper pieces (email_header/email_footer)
   * rather than an actual sendable notification type — same storage (this
   * registry, the same notification_templates row shape, the same Text/Code
   * editor and sanitizer) but never looked up by sendNotification directly,
   * never has its own subject/recipients, and is listed separately on the
   * Templates tab (see templates-service.ts's listStructuralTemplateViews).
   */
  isStructural?: boolean;
  /** Only meaningful for email_footer — the `#rrggbb` a freshly-created row falls back to until an admin picks their own (see template-editor-page.tsx's background-color control). */
  defaultBackgroundColor?: string;
  /**
   * Names (from `variables` above) whose actual value is a live authentication secret — a
   * password-reset/activation code, a device-verification OTP. sendNotification redacts these
   * values out of what actually gets persisted to email_messages (the Message Centre's entire data
   * source, readable by admin/reviewer/auditor) before writing the row; the real SMTP send still
   * gets the real value. See notification-service.ts's own doc comment on why this exists — a
   * working authentication secret has no legitimate reason to sit in a database column multiple
   * internal roles can read back at any time. Also disables "Resend" for a template with any of
   * these (see message-detail-container.tsx) — resending a redacted value would just send a
   * placeholder, and issuing a fresh code through the real flow is the correct alternative anyway.
   */
  secretVariableNames?: string[];
}

/** Available on every template, in addition to its own list below — kept out of each definition's own `variables` array so it isn't repeated seven times. */
export const COMMON_VARIABLES: NotificationVariable[] = [
  { name: 'portalName', description: "The portal's configured name (Settings → General)" },
  { name: 'organizationName', description: 'The configured organization name (Settings → General)' },
  {
    name: 'logoUrl',
    description:
      "The small logo configured in Settings → General — use it to place your own <img> tag anywhere, e.g. in the header template. Blank if no logo has been uploaded yet."
  }
];

/**
 * The fixed set of notification types this app actually sends — every entry
 * here corresponds to exactly one real trigger point in the codebase (see
 * each key's own comment). This is the single source of truth for both the
 * Settings → Templates editor (which lets an admin override subject/body/CC/
 * BCC per key) and notification-service.ts's sendNotification (which looks
 * up a saved override by key, or falls back to these defaults if none has
 * been saved yet).
 */
export const NOTIFICATION_TEMPLATES: NotificationTemplateDefinition[] = [
  {
    key: 'case_doctor_submitted',
    label: 'Case ready for HR review',
    description: 'Sent to reviewers when a doctor submits their assessment for a case.',
    defaultSubject: '{{portalName}}: case {{caseId}} is ready for HR review',
    defaultBody:
      '<p>A doctor has submitted their assessment for <strong>{{patientName}}</strong>’s case (<strong>{{caseId}}</strong>).</p><p>It’s now waiting in the HR review queue.</p>',
    variables: [
      { name: 'caseId', description: 'The case identifier' },
      { name: 'patientName', description: "The patient's full name" }
    ]
  },
  {
    key: 'case_reviewed',
    label: 'Case reviewed',
    description: 'Sent to the assigned doctor when HR completes their review of a case.',
    defaultSubject: '{{portalName}}: case {{caseId}} has been reviewed',
    defaultBody: '<p>HR has completed their review of <strong>{{patientName}}</strong>’s case (<strong>{{caseId}}</strong>).</p>',
    variables: [
      { name: 'caseId', description: 'The case identifier' },
      { name: 'patientName', description: "The patient's full name" }
    ]
  },
  {
    key: 'case_payment_confirmed',
    label: 'Payment confirmed',
    description: 'Sent to the assigned doctor when a case is marked as paid.',
    defaultSubject: '{{portalName}}: payment confirmed for case {{caseId}}',
    defaultBody: '<p>Payment for case <strong>{{caseId}}</strong> ({{patientName}}) was confirmed on <strong>{{paidOn}}</strong>.</p>',
    variables: [
      { name: 'caseId', description: 'The case identifier' },
      { name: 'patientName', description: "The patient's full name" },
      { name: 'paidOn', description: 'The date payment was recorded' }
    ]
  },
  {
    key: 'case_sent_back',
    label: 'Case sent back to patient',
    description: 'Sent to the patient when their case is sent (or reopened) back to them to complete or correct.',
    defaultSubject: '{{portalName}}: your medical case needs attention',
    defaultBody:
      '<p>Hi {{patientName}},</p><p>Your medical case (<strong>{{caseId}}</strong>) has been sent back to you to complete or update.</p><p>Please sign in to {{portalName}} to continue.</p>',
    variables: [
      { name: 'caseId', description: 'The case identifier' },
      { name: 'patientName', description: "The patient's full name" }
    ]
  },
  {
    key: 'case_moved_forward',
    label: 'Case moved forward to a doctor',
    description: 'Sent to a doctor when a case is assigned/sent to them.',
    defaultSubject: '{{portalName}}: new case assigned to you',
    defaultBody:
      '<p>Hi {{doctorName}},</p><p>A new case for <strong>{{patientName}}</strong> (<strong>{{caseId}}</strong>) has been assigned to you and is ready for your assessment.</p>',
    variables: [
      { name: 'caseId', description: 'The case identifier' },
      { name: 'patientName', description: "The patient's full name" },
      { name: 'doctorName', description: "The assigned doctor's name" }
    ]
  },
  {
    key: 'password_reset',
    label: 'Password reset',
    description: "Sent when an admin/HR resets a user's password, or the account holder requests one themselves via \"Forgot password?\" on the sign-in page.",
    defaultSubject: '{{portalName}}: your password reset code',
    defaultBody:
      '<p>Hi {{recipientName}},</p><p>A password reset was requested for your {{portalName}} account.</p><p>Your reset code is: <strong>{{resetCode}}</strong></p><p>Enter it at {{resetUrl}} along with a new password of your choosing. This code expires soon and can only be used once.</p><p>If you didn’t request this, you can ignore this email.</p>',
    variables: [
      { name: 'recipientName', description: "The account holder's name" },
      { name: 'resetCode', description: 'The 6-digit, single-use reset code' },
      { name: 'resetUrl', description: 'The page where the code is redeemed' }
    ],
    secretVariableNames: ['resetCode']
  },
  {
    key: 'account_created',
    label: 'Account created',
    description: 'Sent to a newly created user with an activation code to set their own password.',
    defaultSubject: 'Welcome to {{portalName}}',
    defaultBody:
      '<p>Hi {{recipientName}},</p><p>An account has been created for you on {{portalName}}.</p><p>Your email is <strong>{{email}}</strong> and your activation code is: <strong>{{activationCode}}</strong></p><p>Enter it at {{resetUrl}} to choose your own password. This code will expire and can only be used once — if it has, ask whoever set up your account for a new one.</p>',
    variables: [
      { name: 'recipientName', description: "The new account holder's name" },
      { name: 'email', description: 'Their sign-in email address' },
      { name: 'activationCode', description: 'The 6-digit, single-use activation code' },
      { name: 'resetUrl', description: 'The page where the code is redeemed' }
    ],
    secretVariableNames: ['activationCode']
  },
  {
    key: 'device_verification_code',
    label: 'New device verification code',
    description: 'Sent during sign-in when the browser/device isn’t recognized — must be entered before the sign-in completes.',
    defaultSubject: '{{portalName}}: your verification code',
    defaultBody:
      '<p>Hi {{recipientName}},</p><p>We don’t recognize the device you’re signing in from. Enter this code to continue:</p><p><strong style="font-size:20px;letter-spacing:2px">{{otp}}</strong></p><p>This code expires soon and can only be used once. If you didn’t just try to sign in, you can safely ignore this email — your account is still protected by your password.</p>',
    variables: [
      { name: 'recipientName', description: "The account holder's name" },
      { name: 'otp', description: 'The one-time verification code' }
    ],
    secretVariableNames: ['otp']
  },
  {
    key: 'new_device_signed_in',
    label: 'New device signed in',
    description: 'Sent right after a new device is successfully verified — informational, since the code already proved it was really them.',
    defaultSubject: '{{portalName}}: your account was signed into from a new device',
    defaultBody:
      '<p>Hi {{recipientName}},</p><p>Your {{portalName}} account was just signed into from a new device or browser. For your security, only one device can be signed in at a time, so any other active session has been signed out.</p><p>If this was you, no action is needed. If it wasn’t, change your password immediately and contact an administrator.</p>',
    variables: [{ name: 'recipientName', description: "The account holder's name" }]
  },
  {
    key: 'email_header',
    label: 'Email header',
    description: 'Shown below the logo, at the top of every outgoing email — shared across every notification type.',
    isStructural: true,
    defaultSubject: '',
    defaultBody: '',
    variables: []
  },
  {
    key: 'email_footer',
    label: 'Email footer',
    description: 'Shown at the bottom of every outgoing email — shared across every notification type.',
    isStructural: true,
    defaultSubject: '',
    // No wrapping <div> here on purpose — TipTap's schema has no generic div node, so a hand-written
    // wrapper would get silently flattened (and its background/padding lost) the moment this is
    // opened in Text mode. The colored band itself is a first-class field instead (backgroundColor,
    // below) that notification-email.tsx/email-preview.tsx apply as the actual wrapper.
    defaultBody:
      '<p style="color:#ffffff;margin:0 0 8px">Stay safe – from team {{organizationName}}</p><p style="color:#ffffff;margin:0;font-size:12px">This is an automated message from {{organizationName}}. Please do not reply directly to this email.</p>',
    defaultBackgroundColor: EMAIL_BRAND.footerBackground,
    variables: []
  }
];

export function findNotificationTemplateDefinition(key: string): NotificationTemplateDefinition | undefined {
  return NOTIFICATION_TEMPLATES.find((template) => template.key === key);
}
