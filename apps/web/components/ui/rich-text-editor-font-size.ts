import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (fontSize: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

/**
 * TipTap ships no official font-size control — this is the standard pattern
 * from its own docs: piggyback a `fontSize` attribute onto the existing
 * `textStyle` mark (already registered by @tiptap/extension-text-style,
 * which Color already extends the same way for its own attribute) rather
 * than inventing a new mark from scratch.
 *
 * Deliberately independent of Bold and of Heading (H2/H3): those stay
 * exactly as they were. This just lets a run of plain-weight text be made
 * bigger or smaller without also becoming bold — Heading's default styling
 * bundles both together (bigger *and* bold), which has no equivalent
 * "just bigger" option without this.
 */
export const FontSize = Extension.create({
  name: 'fontSize',

  addOptions() {
    return { types: ['textStyle'] };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize || null,
            renderHTML: (attributes: { fontSize?: string | null }) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            }
          }
        }
      }
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run()
    };
  }
});
