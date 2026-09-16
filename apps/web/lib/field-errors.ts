import type { ZodError } from 'zod';

/**
 * Flattens a Zod validation error into one message per top-level field, for the
 * fieldErrors a form component keys off of to show inline messages next to each
 * input. Only the first message per field is kept — every action here shows at
 * most one error per field, not a full list. Every server action that
 * safeParse()s a flat form (not the nested-object forms parseNestedFormData
 * builds, which each validate their own way) shares this same shape.
 */
export function fieldErrorsFrom(error: ZodError): Record<string, string> {
  const flattened = error.flatten().fieldErrors;
  return Object.fromEntries(
    Object.entries(flattened)
      .filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].length > 0)
      .map(([field, messages]) => [field, messages[0]!])
  );
}
