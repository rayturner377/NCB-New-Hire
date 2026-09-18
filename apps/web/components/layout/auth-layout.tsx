import Image from 'next/image';
import type { ReactNode } from 'react';
import { LogoMark } from '../brand/logo-mark';
import { Skeleton } from '../ui/skeleton';

export interface AuthLayoutProps {
  children: ReactNode;
  /** Settings → General's "Login screen image" (loginImageDataUrl) — see login/page.tsx. */
  imageSrc?: string;
  /** The large logo configured under Settings → General — see settings-service.ts's getPublicSettings. */
  logoSrc?: string;
}

/**
 * Split-screen auth shell — a form panel on the left, a branded image panel
 * on the right — reused by the login screen (and any future auth screen,
 * e.g. password reset). Both the logo and the right-panel image are
 * upload-driven (Settings → General), rendering skeleton placeholders until
 * an admin has uploaded one.
 *
 * `h-screen overflow-y-auto` (not `min-h-screen`) — globals.css sets
 * `body { overflow: hidden }` so AppShell's `<main>` is the only place that
 * scrolls by default; this layout needs to scroll internally too, on a
 * small screen where the form is taller than the viewport.
 */
export function AuthLayout({ children, imageSrc, logoSrc }: AuthLayoutProps) {
  return (
    <div className="grid h-screen overflow-y-auto bg-background lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-20">
        <div className="mx-auto w-full max-w-sm">
          <LogoMark size="lg" className="mb-10" src={logoSrc} />
          {children}
        </div>
        <p className="mx-auto mt-10 w-full max-w-sm text-xs text-muted-foreground">
          © {new Date().getFullYear()} National Commercial Bank Jamaica Limited. All rights reserved.
        </p>
      </div>

      <div className="relative hidden bg-primary/5 lg:block">
        {imageSrc ? (
          // unoptimized: the source is an uploaded/external asset whose host isn't known ahead of time for next/image's remotePatterns allowlist.
          // priority: this image is the page's LCP element (it fills the whole right panel, always above the fold on lg+) — priority
          // makes next/image render it with loading="eager" plus a <link rel="preload">, instead of the lazy-loading it defaults to.
          <Image src={imageSrc} alt="" fill unoptimized priority className="object-cover" />
        ) : (
          <Skeleton className="absolute inset-0 h-full w-full rounded-none" aria-label="Auth screen image placeholder" />
        )}
      </div>
    </div>
  );
}
