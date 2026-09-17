import { Code2, PaintBucket, Type } from 'lucide-react';
import { COMMON_VARIABLES } from '../registry';
import type { NotificationTemplateView } from '../services/templates-service';
import { Button } from '../../../components/ui/button';
import { HtmlCodeEditor } from '../../../components/ui/html-code-editor';
import { Label } from '../../../components/ui/label';
import { RichTextEditor } from '../../../components/ui/rich-text-editor';
import { cn } from '../../../lib/utils';
import { VariablesDialog } from './variables-dialog';

export interface TemplateBodyEditorProps {
  template: NotificationTemplateView;
  slot: 'header' | 'footer' | 'body';
  mode: 'text' | 'code';
  onRequestTextMode: () => void;
  onRequestCodeMode: () => void;
  bodyHtml: string;
  onBodyHtmlChange: (html: string) => void;
  backgroundColor: string;
  onBackgroundColorChange: (color: string) => void;
}

/**
 * The editor half of TemplateEditorPage — the body field itself (Text/Code mode toggle, the footer's
 * background-color picker, and the RichTextEditor/HtmlCodeEditor swap), plus the two explanatory
 * notes specific to the header/footer slots. Pulled out of TemplateEditorPage's own JSX since it was
 * the largest single chunk of that component.
 */
export function TemplateBodyEditor({
  template,
  slot,
  mode,
  onRequestTextMode,
  onRequestCodeMode,
  bodyHtml,
  onBodyHtmlChange,
  backgroundColor,
  onBackgroundColorChange
}: TemplateBodyEditorProps) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="body">{template.isStructural ? 'Content' : 'Message'}</Label>
            <VariablesDialog variables={[...COMMON_VARIABLES, ...template.variables]} />
            {slot === 'footer' ? (
              <label
                className="flex h-7 cursor-pointer items-center gap-1.5 rounded-md border px-2 text-xs text-muted-foreground hover:bg-accent"
                title="Footer background color"
              >
                <PaintBucket className="h-3.5 w-3.5" />
                Section background
                <span aria-hidden="true" className="h-3.5 w-3.5 rounded-full border" style={{ backgroundColor: backgroundColor || 'transparent' }} />
                <input
                  type="color"
                  className="sr-only"
                  value={backgroundColor || '#005baa'}
                  onChange={(event) => onBackgroundColorChange(event.target.value)}
                />
                {backgroundColor ? (
                  <button
                    type="button"
                    className="ml-0.5 text-muted-foreground underline-offset-2 hover:underline"
                    onClick={(event) => {
                      event.preventDefault();
                      onBackgroundColorChange('');
                    }}
                  >
                    Clear
                  </button>
                ) : null}
              </label>
            ) : null}
            <input type="hidden" name="backgroundColor" value={backgroundColor} onChange={() => {}} />
          </div>
          <div className="flex items-center gap-0.5 rounded-md border p-0.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn('h-7 gap-1.5 px-2 text-xs', mode === 'text' && 'bg-accent text-accent-foreground')}
              onClick={onRequestTextMode}
            >
              <Type className="h-3.5 w-3.5" /> Text
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn('h-7 gap-1.5 px-2 text-xs', mode === 'code' && 'bg-accent text-accent-foreground')}
              onClick={onRequestCodeMode}
            >
              <Code2 className="h-3.5 w-3.5" /> Code
            </Button>
          </div>
        </div>
        {mode === 'text' ? (
          <RichTextEditor name="body" defaultValue={bodyHtml} onChangeHtml={onBodyHtmlChange} />
        ) : (
          <HtmlCodeEditor name="body" defaultValue={bodyHtml} onChangeHtml={onBodyHtmlChange} />
        )}
        <input type="hidden" name="bodyMode" value={mode} />
      </div>

      {slot === 'header' ? (
        <p className="rounded-md border bg-muted px-3 py-2 text-xs text-muted-foreground">
          Your logo (Settings → General) always shows above this — it&apos;s not part of what you&apos;re typing here, so an empty
          editor means nothing else appears below it. Use the {'{{logoUrl}}'} variable (see &ldquo;View variables&rdquo; above) if you
          want to place your own copy of the logo image somewhere in this content too.
        </p>
      ) : null}

      {slot === 'footer' ? (
        <p className="rounded-md border bg-muted px-3 py-2 text-xs text-muted-foreground">
          The footer is the only section without a fixed white background (the header and message body both keep one, so the logo
          always sits on solid white) — use &ldquo;Section background&rdquo; above for a colored band, like the default blue one.
        </p>
      ) : null}
    </>
  );
}
