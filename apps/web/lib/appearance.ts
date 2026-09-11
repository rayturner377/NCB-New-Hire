/**
 * localStorage key for a single user's own light/dark override, set via the
 * sidebar's AppearanceToggle (components/layout/appearance-toggle.tsx) —
 * separate from Settings → Theme's admin-wide default appearance
 * (features/settings/types.ts's AppSettings['theme']['mode']), which still
 * decides what a first-time visitor (or anyone who hasn't toggled it
 * themselves) sees. Shared between that component and the blocking inline
 * script in app/layout.tsx that applies it before first paint, so both sides
 * always agree on the exact key string.
 */
export const APPEARANCE_STORAGE_KEY = 'ncb.appearance';
