/**
 * Hard-coded for now — there's no settings UI yet to flip these at runtime.
 * Kept as a single named export per flag (not inlined at each call site) so
 * that whenever settings management is built, wiring a flag to a real
 * per-org toggle is a one-line change here rather than hunting down every
 * place a feature renders itself.
 */
export const CASE_DOCUMENT_TOOLS_ENABLED = true;
