import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    backgroundColor: {
      setBackgroundColor: (color: string) => ReturnType;
      unsetBackgroundColor: () => ReturnType;
    };
  }
}

/**
 * Same pattern as Color (text color) and rich-text-editor-font-size.ts's
 * FontSize — another attribute piggybacked onto the existing `textStyle`
 * mark rather than a separate mark/extension, so it composes with color,
 * font size, bold, etc. on the same run of text instead of competing with
 * them. "Clear formatting" (unsetAllMarks) already removes this along with
 * everything else on textStyle, so there's no separate unset control needed
 * in the toolbar.
 */
export const BackgroundColor = Extension.create({
  name: 'backgroundColor',

  addOptions() {
    return { types: ['textStyle'] };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          backgroundColor: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.backgroundColor || null,
            renderHTML: (attributes: { backgroundColor?: string | null }) => {
              if (!attributes.backgroundColor) return {};
              return { style: `background-color: ${attributes.backgroundColor}` };
            }
          }
        }
      }
    ];
  },

  addCommands() {
    return {
      setBackgroundColor:
        (color: string) =>
        ({ chain }) =>
          chain().setMark('textStyle', { backgroundColor: color }).run(),
      unsetBackgroundColor:
        () =>
        ({ chain }) =>
          chain().setMark('textStyle', { backgroundColor: null }).removeEmptyTextStyle().run()
    };
  }
});
