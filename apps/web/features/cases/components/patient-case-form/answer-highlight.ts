/**
 * Flags a value the patient actually disclosed when a tab is shown
 * read-only (the doctor's read-only view of the patient's submission, or the
 * patient's own view after they've submitted) — a plain muted/disabled look
 * reads the same whether a question was answered "yes" or left at its
 * default "no", so a real "yes" (and whatever detail it unlocked) needs its
 * own visual signal to stand out from the rest of the greyed-out form.
 * `disabled:opacity-100` overrides the field's usual `disabled:opacity-50`
 * so the highlight itself doesn't get washed out.
 */
export const ANSWER_HIGHLIGHT_CLASS =
  'border-amber-400 bg-amber-50 text-amber-950 disabled:opacity-100 dark:border-amber-500/60 dark:bg-amber-950/40 dark:text-amber-100';
