'use client';

import { useState } from 'react';

export interface HtmlCodeEditorProps {
  /** Mirrors the current source into a hidden input under this name, same convention as rich-text-editor.tsx — only one of the two editors is ever mounted at a time (see template-editor-page.tsx's mode toggle), so there's never a duplicate-name collision. */
  name: string;
  defaultValue?: string;
  onChangeHtml?: (html: string) => void;
}

/**
 * The Templates tab's "Code mode" — a plain monospace textarea for pasting
 * real HTML with embedded/inline CSS directly, for layouts the WYSIWYG
 * editor (rich-text-editor.tsx) can't produce (multi-column tables, custom
 * spacing, etc.). Deliberately not a syntax-highlighting code editor
 * (CodeMirror/Monaco) — this app has no other use for one, and a plain
 * textarea is enough for "paste/edit raw markup."
 *
 * Whatever's written here still goes through the same compliance sanitizer
 * as Text mode on save (sanitize-email-html.ts) — this editor doesn't try to
 * block a pasted `<a>` tag itself, the server-side save does.
 */
export function HtmlCodeEditor({ name, defaultValue = '', onChangeHtml }: HtmlCodeEditorProps) {
  const [html, setHtml] = useState(defaultValue);

  function handleChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = event.target.value;
    setHtml(next);
    onChangeHtml?.(next);
  }

  return (
    <div className="rounded-md border">
      <div className="border-b bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
        HTML source — embedded <code>&lt;style&gt;</code> and inline styles are supported
      </div>
      <textarea
        value={html}
        onChange={handleChange}
        spellCheck={false}
        className="min-h-[220px] w-full resize-y bg-transparent px-3 py-2.5 font-mono text-xs leading-5 focus:outline-none"
        placeholder="<p>Hello {{recipientName}},</p>"
      />
      <input type="hidden" name={name} value={html} onChange={() => {}} />
    </div>
  );
}
