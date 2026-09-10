/**
 * Converts a `#rrggbb` hex color (what a native `<input type="color">` gives
 * back) into the bare `h s% l%` triplet shadcn's CSS variables expect (see
 * app/globals.css's `--primary`, etc.) — those are consumed as
 * `hsl(var(--primary))`, so the stored value must NOT include the `hsl()`
 * wrapper itself.
 */
export function hexToHslTriplet(hex: string): string {
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return `0 0% ${Math.round(l * 100)}%`;
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
  }
  h *= 60;

  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Re-lights an admin-picked color for use in dark mode, keeping its hue/
 * saturation but clamping lightness into the range that role needs to stay
 * legible against a near-black background — see layout.tsx, which applies
 * the single color an admin picks in Settings → Theme to BOTH `:root` and
 * `.dark`. Reusing the exact light-mode lightness in dark mode broke the
 * pairing with globals.css's (unmodified) dark-mode foreground tokens: a
 * `--primary` still as dark as its light-mode navy sits under `.dark`'s own
 * near-black `--primary-foreground` (tuned for a *bright* dark-mode primary),
 * reading as dark-blue-on-black; the same for a pale `--accent` under `.dark`'s
 * near-white `--accent-foreground`, reading as washed-out grey-on-white on
 * hover. Clamping — rather than just inverting lightness — keeps whatever the
 * admin already picked as long as it's already in a workable range, only
 * pulling it toward one when it isn't.
 */
export function clampLightnessForDarkMode(triplet: string, minPercent: number, maxPercent: number): string {
  const match = triplet.match(/^(\d+) (\d+)% (\d+)%$/);
  if (!match) return triplet;
  const [, h, s, l] = match;
  const clamped = Math.min(maxPercent, Math.max(minPercent, Number(l)));
  return `${h} ${s}% ${clamped}%`;
}

/** Inverse of hexToHslTriplet — for pre-filling a color picker's value from a stored triplet. */
export function hslTripletToHex(triplet: string): string {
  const match = triplet.match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  if (!match) return '#000000';
  const h = Number(match[1]) / 360;
  const s = Number(match[2]) / 100;
  const l = Number(match[3]) / 100;

  if (s === 0) {
    const v = Math.round(l * 255);
    return `#${[v, v, v].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = hue2rgb(p, q, h + 1 / 3);
  const g = hue2rgb(p, q, h);
  const b = hue2rgb(p, q, h - 1 / 3);

  return `#${[r, g, b]
    .map((c) => Math.round(c * 255).toString(16).padStart(2, '0'))
    .join('')}`;
}
