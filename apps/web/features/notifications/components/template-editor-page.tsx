'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { updateTemplateAction } from '../actions/update-template';
import type { NotificationTemplateView } from '../services/templates-service';
import { SAMPLE_VARIABLE_VALUES } from '../sample-variable-values';
import { substituteBodyVariables, substituteVariables } from '../template-rendering';
import { Badge } from '../../../components/ui/badge';
import { Checkbox } from '../../../components/ui/checkbox';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { SettingsSectionForm } from '../../settings/components/settings-section-form';
import type { EmailPreviewBranding } from './email-preview';
import { TemplateBodyEditor } from './template-body-editor';
import { TemplatePreviewPanel } from './template-preview-panel';

/** Stands in for a real notification's own body when previewing the shared header/footer templates in isolation — there's no "real" message to show since these aren't sent on their own. */
const SAMPLE_BODY_HTML = '<p>This is a sample message, shown here so you can see how your header and footer look around real content.</p>';

export interface TemplateEditorPageProps {
  template: NotificationTemplateView;
  branding: EmailPreviewBranding;
  /**
   * The *other* shared piece's current HTML, already substituted with sample
   * values by the container — when editing email_header this is the current
   * email_footer (and vice versa), so the preview shows a complete, realistic
   * email around whichever piece is being edited. Unused when editing an
   * ordinary notification template, since that preview needs both pieces.
   */
  otherHeaderHtml?: string;
  otherFooterHtml?: string;
  /** Only relevant when otherFooterHtml is shown (editing email_header or an ordinary notification) — the footer's own saved background color, so the full-context preview matches what a real email actually looks like. */
  otherFooterBackgroundColor?: string;
}

/**
 * The dedicated per-template editor (/settings/templates/[key]) — a real
 * HTML editor (RichTextEditor) on the left, a live preview of the actual
 * branded email on the right, so an admin can see exactly how their
 * formatting looks before saving. Handles three cases with the same form and
 * editor: an ordinary notification's own message body, and the two shared
 * wrapper pieces (email_header/email_footer, template.isStructural) — those
 * skip the subject/CC/BCC/enabled fields (they don't apply to a shared piece
 * with no recipient of its own) and route the live-edited HTML into the
 * matching slot of the preview instead of the main body.
 */
export function TemplateEditorPage({
  template,
  branding,
  otherHeaderHtml = '',
  otherFooterHtml = '',
  otherFooterBackgroundColor = ''
}: TemplateEditorPageProps) {
  const [subject, setSubject] = useState(template.subject);
  const [bodyHtml, setBodyHtml] = useState(template.body);
  const [mode, setMode] = useState<'text' | 'code'>(template.bodyMode);
  const [backgroundColor, setBackgroundColor] = useState(template.backgroundColor);

  const slot: 'header' | 'footer' | 'body' = template.key === 'email_header' ? 'header' : template.key === 'email_footer' ? 'footer' : 'body';

  function switchToTextMode() {
    if (mode === 'code' && bodyHtml.trim()) {
      const confirmed = window.confirm(
        'Switching to Text mode re-parses this through the formatting editor, which can reformat or drop HTML/CSS the code editor produced. Continue?'
      );
      if (!confirmed) return;
    }
    setMode('text');
  }

  const sampleValues: Record<string, string> = {
    portalName: branding.portalName,
    organizationName: branding.organizationName,
    logoUrl: branding.logoUrl ?? '',
    ...Object.fromEntries(template.variables.map((variable) => [variable.name, SAMPLE_VARIABLE_VALUES[variable.name] ?? `Sample ${variable.name}`]))
  };
  const previewSubject = substituteVariables(subject, sampleValues);
  const liveHtml = substituteBodyVariables(bodyHtml, sampleValues);

  const previewProps =
    slot === 'header'
      ? { bodyHtml: SAMPLE_BODY_HTML, headerHtml: liveHtml, footerHtml: otherFooterHtml, footerBackgroundColor: otherFooterBackgroundColor }
      : slot === 'footer'
        ? { bodyHtml: SAMPLE_BODY_HTML, headerHtml: otherHeaderHtml, footerHtml: liveHtml, footerBackgroundColor: backgroundColor }
        : { bodyHtml: liveHtml, headerHtml: otherHeaderHtml, footerHtml: otherFooterHtml, footerBackgroundColor: otherFooterBackgroundColor };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Link href="/settings?tab=templates" className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to templates
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">{template.label}</h1>
          {!template.isStructural && !template.enabled ? (
            <Badge variant="secondary" className="text-[10px]">
              Off
            </Badge>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">{template.description}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SettingsSectionForm action={updateTemplateAction}>
          <input type="hidden" name="key" value={template.key} />

          {template.isStructural ? (
            // Shared wrapper pieces have no recipient of their own to disable sending to, and no
            // subject/CC/BCC — hidden inputs keep updateTemplateAction's existing schema (which
            // still validates a non-empty subject) satisfied without showing fields that don't apply.
            <>
              <input type="hidden" name="enabled" value="true" />
              <input type="hidden" name="subject" value={`(shared ${slot} — not an independent email)`} />
            </>
          ) : (
            <>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox name="enabled" defaultChecked={template.enabled} />
                Send this notification
              </label>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="subject">Subject</Label>
                <Input id="subject" name="subject" value={subject} onChange={(event) => setSubject(event.target.value)} required />
              </div>
            </>
          )}

          <TemplateBodyEditor
            template={template}
            slot={slot}
            mode={mode}
            onRequestTextMode={switchToTextMode}
            onRequestCodeMode={() => setMode('code')}
            bodyHtml={bodyHtml}
            onBodyHtmlChange={setBodyHtml}
            backgroundColor={backgroundColor}
            onBackgroundColorChange={setBackgroundColor}
          />

          {!template.isStructural ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ccEmails">CC</Label>
                <Input id="ccEmails" name="ccEmails" defaultValue={template.ccEmails} placeholder="optional" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bccEmails">BCC</Label>
                <Input id="bccEmails" name="bccEmails" defaultValue={template.bccEmails} placeholder="optional" />
              </div>
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Per the NCB Email Design Style Guide, outgoing emails can&apos;t contain clickable links — that&apos;s why there&apos;s no link
            tool in Text mode. Any variable value that looks like a URL or phone number (like {'{{loginUrl}}'}) is automatically
            shown as plain, de-linked text.
            {mode === 'code'
              ? ' In Code mode this is enforced on save instead: any <a> tag, script, or embedded frame is automatically stripped out.'
              : null}
            {template.isStructural ? ' This content appears on every outgoing email, not just one notification type.' : null}
          </p>
        </SettingsSectionForm>

        <TemplatePreviewPanel template={template} branding={branding} subject={previewSubject} previewProps={previewProps} />
      </div>
    </div>
  );
}
