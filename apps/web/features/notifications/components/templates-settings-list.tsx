import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import type { NotificationTemplateView } from '../services/templates-service';

export interface TemplatesSettingsListProps {
  templates: NotificationTemplateView[];
  /** Overrides the intro paragraph — reused as-is by the Templates tab's separate "Header & footer" section (see settings-container.tsx), which lists email_header/email_footer through this same component. */
  description?: string;
}

/**
 * Every notification type as a clickable row — clicking one opens its own
 * dedicated editor page (/settings/templates/[key], see
 * template-editor-page.tsx) with a real HTML editor and a live preview,
 * rather than expanding a plain-textarea form inline on this tab.
 */
export function TemplatesSettingsList({
  templates,
  description = "Every automated email this app sends, in one place — open one to change its wording, formatting, or CC/BCC, or turn it off entirely."
}: TemplatesSettingsListProps) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="flex flex-col divide-y rounded-md border">
        {templates.map((template) => (
          <Link
            key={template.key}
            href={`/settings/templates/${template.key}`}
            className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{template.label}</span>
                {!template.enabled ? (
                  <Badge variant="secondary" className="text-[10px]">
                    Off
                  </Badge>
                ) : null}
              </div>
              <span className="text-xs text-muted-foreground">{template.description}</span>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </div>
  );
}
