import type { Metadata } from 'next';
import NextTopLoader from 'nextjs-toploader';
import { APPEARANCE_STORAGE_KEY } from '../lib/appearance';
import { clampLightnessForDarkMode, hexToHslTriplet } from '../lib/color';
import { getPublicSettings } from '../features/settings/services/settings-service';
import './globals.css';

export const metadata: Metadata = {
  title: 'National Commercial Bank Jamaica Medical Platform'
};

/**
 * Reads only the public (branding/theme) slice of settings — see
 * settings-service.ts's getPublicSettings — so the login screen and every
 * other unauthenticated page pick up the org's theme too, not just pages
 * under the authenticated shell. Theme mode sets `.dark` on `<html>`
 * server-side (no next-themes/flash-of-wrong-theme client script needed,
 * since this is a single admin-wide default rather than a per-visitor
 * preference); the three configurable colors override shadcn's CSS
 * variables (see globals.css) via an inline `<style>` — hexToHslTriplet
 * converts the `<input type="color">` hex value settings stores into the
 * bare `h s% l%` format those variables expect.
 *
 * The admin only ever picks one color per role (there's no separate "dark
 * mode primary" picker), but that same color can't be reused as-is in both
 * modes — `.dark`'s foreground tokens (globals.css) are tuned to pair with a
 * bright primary and a dark accent, the opposite of what light mode needs.
 * clampLightnessForDarkMode keeps the admin's hue/saturation but re-lights
 * each one into the range its role needs to stay legible against a
 * near-black background, so a dark navy brand blue still reads as a visible
 * button in dark mode instead of nearly-black-on-black, and a pale accent
 * still reads as a dark hover surface instead of washed-out grey-on-white.
 *
 * `className` here is only ever the *admin's* default — a user can flip
 * their own view with the sidebar's AppearanceToggle (components/layout/
 * appearance-toggle.tsx), which persists to localStorage under
 * APPEARANCE_STORAGE_KEY and is applied by directly toggling this same
 * `dark` class. The blocking inline script below re-applies that override
 * (if any) before first paint — without it, every page load would flash the
 * admin's default first and only switch to the user's own choice once
 * AppearanceToggle mounts. suppressHydrationWarning on `<html>` is required
 * because of that: this script can leave the actual DOM class attribute
 * different from what this render returned, which React would otherwise
 * flag as a hydration mismatch even though it's intentional.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { theme } = await getPublicSettings();
  const primaryLight = hexToHslTriplet(theme.primaryColor);
  const accentLight = hexToHslTriplet(theme.accentColor);
  const dangerLight = hexToHslTriplet(theme.dangerColor);

  // Ranges matched to globals.css's own hand-tuned .dark defaults: --primary/--ring sit
  // under a near-black foreground in dark mode (needs to stay bright), --accent is a
  // hover/selection *background* under a near-white foreground (needs to stay dark),
  // --destructive is dark mode's own more muted danger tone rather than light mode's
  // vivid one.
  const primaryDark = clampLightnessForDarkMode(primaryLight, 50, 70);
  const accentDark = clampLightnessForDarkMode(accentLight, 12, 22);
  const dangerDark = clampLightnessForDarkMode(dangerLight, 28, 45);

  return (
    <html lang="en" className={theme.mode === 'dark' ? 'dark' : undefined} suppressHydrationWarning>
      <head>
        {/*
          !important on every property: globals.css defines --primary/--accent/--destructive
          on both :root and .dark with equal (0,1,0) specificity to a plain :root override here,
          so which one wins would otherwise depend on Next's stylesheet injection order relative
          to this inline tag — not guaranteed. !important sidesteps that entirely, guaranteeing
          the admin's colors always win in both light and dark mode regardless of load order.
        */}
        <style>{`:root{--primary:${primaryLight} !important;--ring:${primaryLight} !important;--accent:${accentLight} !important;--destructive:${dangerLight} !important}.dark{--primary:${primaryDark} !important;--ring:${primaryDark} !important;--accent:${accentDark} !important;--destructive:${dangerDark} !important}`}</style>
        {/* Blocking (no async/defer) so it runs before body paint — see this component's own doc comment above. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var v=localStorage.getItem(${JSON.stringify(APPEARANCE_STORAGE_KEY)});if(v==='dark')document.documentElement.classList.add('dark');else if(v==='light')document.documentElement.classList.remove('dark');}catch(e){}})();`
          }}
        />
      </head>
      <body>
        <NextTopLoader showSpinner={false} height={3} />
        {children}
      </body>
    </html>
  );
}
