/**
 * Captures the exact moment a signature is drawn/typed — date, time, and the
 * signer's named local timezone, all baked in at capture time — rather than a
 * bare date. If a signature is ever disputed, whoever's looking at it later
 * needs to see what time it actually was for the person who signed, not a
 * time recomputed in their own browser's timezone from a stored UTC instant.
 * `Date.prototype.toString()` (e.g. "Wed Jan 15 2026 15:45:12 GMT-0500
 * (Eastern Standard Time)") bakes the offset and zone name in permanently and
 * still round-trips through `Date.parse` on this app's own runtime.
 */
export function captureSignatureTimestamp(): string {
  return new Date().toString();
}
