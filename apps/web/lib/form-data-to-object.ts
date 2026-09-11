/**
 * Reconstructs a nested object from FormData using dot-notation field names
 * (e.g. "assessment.facilityName" -> { assessment: { facilityName: ... } }),
 * since Zod schemas here model nested objects but a plain HTML form posts a
 * flat FormData. File/Blob values are skipped — this only builds plain data.
 */
export function parseNestedFormData(formData: FormData): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    if (typeof value !== 'string') continue;

    const path = key.split('.');
    let target = result;
    for (let i = 0; i < path.length - 1; i += 1) {
      const segment = path[i] as string;
      if (typeof target[segment] !== 'object' || target[segment] === null) {
        target[segment] = {};
      }
      target = target[segment] as Record<string, unknown>;
    }
    target[path[path.length - 1] as string] = value;
  }

  return result;
}
