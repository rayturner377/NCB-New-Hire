'use client';

import { useEffect, useState } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Bold, Italic, Underline as UnderlineIcon, Strikethrough, Heading2, Heading3, List, ListOrdered, Quote, AlignLeft, AlignCenter, AlignRight, Undo, Redo, RemoveFormatting, Highlighter } from 'lucide-react';
import { Button } from './button';
import { BackgroundColor } from './rich-text-editor-background-color';
import { FontSize } from './rich-text-editor-font-size';
import { cn } from '../../lib/utils';

/**
 * Independent of Bold/Heading on purpose — an admin can make plain-weight
 * text bigger or smaller without it becoming bold, and vice versa. "Default"
 * removes the override entirely rather than pinning a specific px value, so
 * text without an explicit size still inherits the surrounding template's own
 * styling (e.g. a heading's own size) instead of being forced back to body size.
 */
const FONT_SIZES: { label: string; value: string }[] = [
  { label: 'Default', value: '' },
  { label: 'Small', value: '12px' },
  { label: 'Normal', value: '15px' },
  { label: 'Large', value: '18px' },
  { label: 'X-Large', value: '22px' },
  { label: 'XX-Large', value: '28px' }
];

export interface RichTextEditorProps {
  /** Mirrors the editor's current HTML into a hidden input under this name, so the surrounding `<form>` submits it like any other field — same pattern as date-field.tsx/yes-no-select.tsx. */
  name: string;
  defaultValue?: string;
  onChangeHtml?: (html: string) => void;
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  label,
  children
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn('h-8 w-8', active && 'bg-accent text-accent-foreground')}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      {children}
    </Button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/40 p-1.5">
      <ToolbarButton label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>

      <span className="mx-1 h-5 w-px bg-border" />

      <select
        aria-label="Font size"
        title="Font size"
        className="h-8 rounded-md border bg-background px-1.5 text-xs"
        value={(editor.getAttributes('textStyle').fontSize as string | undefined) ?? ''}
        onChange={(event) => {
          const value = event.target.value;
          if (value) {
            editor.chain().focus().setFontSize(value).run();
          } else {
            editor.chain().focus().unsetFontSize().run();
          }
        }}
      >
        {FONT_SIZES.map((size) => (
          <option key={size.label} value={size.value}>
            {size.label}
          </option>
        ))}
      </select>

      <span className="mx-1 h-5 w-px bg-border" />

      <ToolbarButton
        label="Heading"
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Subheading"
        active={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote className="h-4 w-4" />
      </ToolbarButton>

      <span className="mx-1 h-5 w-px bg-border" />

      <ToolbarButton label="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
        <AlignLeft className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Align center"
        active={editor.isActive({ textAlign: 'center' })}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
      >
        <AlignCenter className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Align right"
        active={editor.isActive({ textAlign: 'right' })}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
      >
        <AlignRight className="h-4 w-4" />
      </ToolbarButton>

      <span className="mx-1 h-5 w-px bg-border" />

      <label className="mx-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md hover:bg-accent" title="Text color">
        <span className="sr-only">Text color</span>
        <span
          aria-hidden="true"
          className="h-4 w-4 rounded-full border"
          style={{ backgroundColor: (editor.getAttributes('textStyle').color as string | undefined) ?? '#1a1a1a' }}
        />
        <input
          type="color"
          className="sr-only"
          onChange={(event) => editor.chain().focus().setColor(event.target.value).run()}
        />
      </label>

      <label className="mx-1 flex h-8 w-8 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md hover:bg-accent" title="Background color">
        <span className="sr-only">Background color</span>
        <Highlighter aria-hidden="true" className="h-4 w-4" />
        <span
          aria-hidden="true"
          className="h-1 w-4 rounded-sm border"
          style={{ backgroundColor: (editor.getAttributes('textStyle').backgroundColor as string | undefined) ?? 'transparent' }}
        />
        <input
          type="color"
          className="sr-only"
          onChange={(event) => editor.chain().focus().setBackgroundColor(event.target.value).run()}
        />
      </label>

      <ToolbarButton label="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
        <RemoveFormatting className="h-4 w-4" />
      </ToolbarButton>

      <span className="mx-1 h-5 w-px bg-border" />

      <ToolbarButton label="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
        <Undo className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
        <Redo className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}

/**
 * The Templates tab's HTML editor — a real WYSIWYG toolbar (bold/italic/
 * underline, headings, lists, alignment, text color) over TipTap, producing
 * actual HTML. Mirrors its content into a hidden input under `name` so the
 * surrounding form submits it like any plain field would; `immediatelyRender:
 * false` sidesteps a known TipTap/Next.js App Router SSR hydration-mismatch
 * warning (the editor has no meaningful server-rendered content anyway).
 *
 * Deliberately no Link extension/toolbar button: the NCB Email Design Style
 * Guide requires every outgoing email to contain no clickable hyperlinks at
 * all (URLs are shown as plain, deliberately de-linked text instead — see
 * features/notifications/link-deactivation.ts). Since this editor's only
 * current use is authoring notification email bodies, leaving Link out
 * entirely means there's no toolbar affordance for producing exactly the
 * markup the guide forbids, and TipTap drops the `<a>` mark from anything
 * pasted in too (no extension registers it). If this component is ever
 * reused somewhere links legitimately belong, add Link back for that case
 * specifically rather than restoring it here.
 */
export function RichTextEditor({ name, defaultValue = '', onChangeHtml }: RichTextEditorProps) {
  const [html, setHtml] = useState(defaultValue);
  // Forces the toolbar to re-render on pure cursor movement (no content change), so the font-size
  // select — and the existing Bold/Italic/etc. active states — reflect the mark at the new cursor
  // position rather than only updating after the next edit.
  const [, setSelectionTick] = useState(0);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit, Underline, TextStyle, Color, FontSize, BackgroundColor, TextAlign.configure({ types: ['heading', 'paragraph'] })],
    content: defaultValue,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none min-h-[220px] px-3 py-2.5 focus:outline-none'
      }
    },
    onUpdate: ({ editor: current }) => {
      const nextHtml = current.getHTML();
      setHtml(nextHtml);
      onChangeHtml?.(nextHtml);
    },
    onSelectionUpdate: () => setSelectionTick((tick) => tick + 1)
  });

  // Keeps the editor in sync if `defaultValue` changes out from under it (e.g. switching between
  // templates without a full page remount) — TipTap is otherwise uncontrolled after mount.
  useEffect(() => {
    if (editor && defaultValue !== editor.getHTML()) {
      editor.commands.setContent(defaultValue);
      setHtml(defaultValue);
    }
    // `editor` is included for exhaustive-deps correctness; TipTap's useEditor keeps a stable
    // instance across re-renders, so in practice this only re-fires on `defaultValue` changes
    // (a different template loaded) plus the one transition from undefined to the mounted editor,
    // which the `editor &&` guard above already handles safely.
  }, [defaultValue, editor]);

  return (
    <div className="rounded-md border">
      {editor ? <Toolbar editor={editor} /> : null}
      <EditorContent editor={editor} />
      <input type="hidden" name={name} value={html} onChange={() => {}} />
    </div>
  );
}
