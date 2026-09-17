import type { NotificationTemplateView } from '../services/templates-service';
import { EmailPreview, type EmailPreviewBranding, type EmailPreviewProps } from './email-preview';

export interface TemplatePreviewPanelProps {
  template: NotificationTemplateView;
  branding: EmailPreviewBranding;
  subject: string;
  previewProps: Omit<EmailPreviewProps, 'subject' | 'branding'>;
}

/** The right-hand "Live preview" column of TemplateEditorPage — a live-rendered EmailPreview plus the one caption line explaining what it shows, which differs for a shared header/footer piece vs. an ordinary notification. */
export function TemplatePreviewPanel({ template, branding, subject, previewProps }: TemplatePreviewPanelProps) {
  return (
    <div className="flex flex-col gap-2 xl:sticky xl:top-4 xl:self-start">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live preview</p>
      <EmailPreview subject={subject} branding={branding} {...previewProps} />
      <p className="text-xs text-muted-foreground">
        {template.isStructural ? (
          'Shown around a sample message so you can see this in context — the header/footer are the same on every real email.'
        ) : (
          <>Shown with sample values in place of {'{{variables}}'} — this is what a recipient would actually see, de-linked URLs included.</>
        )}
      </p>
    </div>
  );
}
