/** First + last initial from a display name, e.g. "Andrea Campbell" -> "AC". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? '?').concat(parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '').toUpperCase();
}
