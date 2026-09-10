import { notificationTemplatesRepository } from '@ncb/database';
import { findNotificationTemplateDefinition, NOTIFICATION_TEMPLATES } from '../registry';

export interface NotificationTemplateView {
  key: string;
  label: string;
  description: string;
  variables: { name: string; description: string }[];
  subject: string;
  body: string;
  /** Which editor mode `body` was last saved with — 'text' (WYSIWYG) or 'code' (raw HTML/CSS) — see template-editor-page.tsx. */
  bodyMode: 'text' | 'code';
  ccEmails: string;
  bccEmails: string;
  /** Only meaningful for email_footer — see template-editor-page.tsx's background-color control. Empty string means no color set. */
  backgroundColor: string;
  enabled: boolean;
  /** True for email_header/email_footer — see registry.ts's NotificationTemplateDefinition.isStructural. */
  isStructural: boolean;
}

function toView(
  definition: (typeof NOTIFICATION_TEMPLATES)[number],
  override: Awaited<ReturnType<typeof notificationTemplatesRepository.findByKey>>
): NotificationTemplateView {
  return {
    key: definition.key,
    label: definition.label,
    description: definition.description,
    variables: definition.variables,
    subject: override?.subject ?? definition.defaultSubject,
    body: override?.body ?? definition.defaultBody,
    bodyMode: override?.bodyMode === 'code' ? 'code' : 'text',
    ccEmails: override?.ccEmails ?? '',
    bccEmails: override?.bccEmails ?? '',
    backgroundColor: override?.backgroundColor ?? definition.defaultBackgroundColor ?? '',
    enabled: override?.enabled ?? true,
    isStructural: definition.isStructural ?? false
  };
}

/** Every real (non-structural) registry entry, each merged with its saved override (if any) — a key with nothing saved yet shows the registry's own default subject/body, enabled by default, so the Templates tab always has something sensible to display and edit even before an admin has ever touched it. Excludes email_header/email_footer, which are listed separately (see listStructuralTemplateViews). */
export async function listTemplateViews(): Promise<NotificationTemplateView[]> {
  const saved = await notificationTemplatesRepository.list();
  const savedByKey = new Map(saved.map((template) => [template.key, template]));
  return NOTIFICATION_TEMPLATES.filter((definition) => !definition.isStructural).map((definition) =>
    toView(definition, savedByKey.get(definition.key) ?? null)
  );
}

/** Just the two shared wrapper pieces (email_header/email_footer), for the Templates tab's own "Header & footer" section. */
export async function listStructuralTemplateViews(): Promise<NotificationTemplateView[]> {
  const saved = await notificationTemplatesRepository.list();
  const savedByKey = new Map(saved.map((template) => [template.key, template]));
  return NOTIFICATION_TEMPLATES.filter((definition) => definition.isStructural).map((definition) =>
    toView(definition, savedByKey.get(definition.key) ?? null)
  );
}

/** Single-template lookup for the dedicated editor page (/settings/templates/[key]) — avoids fetching and merging all seven when only one is being edited. */
export async function getTemplateView(key: string): Promise<NotificationTemplateView | null> {
  const definition = findNotificationTemplateDefinition(key);
  if (!definition) return null;
  const override = await notificationTemplatesRepository.findByKey(key);
  return toView(definition, override);
}
