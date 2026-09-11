import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nextEnv from '@next/env';

const { loadEnvConfig } = nextEnv;

const dirname = path.dirname(fileURLToPath(import.meta.url));

// apps/web has no .env of its own — the monorepo's single .env lives at the
// repo root (packages/database's Prisma commands already load it via
// dotenv-cli, see the root package.json's db:* scripts). Next.js dev mode
// compiles routes lazily and doesn't reliably inherit the parent shell's env
// into every worker it spins up for that, so load it explicitly here instead
// — this is Next's own documented monorepo pattern (@next/env's
// loadEnvConfig), and runs once before anything else in this process.
loadEnvConfig(path.join(dirname, '..', '..'));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Server Actions default to a 1MB request body cap — too tight for the settings page's logo
    // uploads (see logo-upload-field.tsx), which submit the small AND large logo as inline base64
    // data URLs in the same request alongside the rest of the General tab's fields. Exceeding the
    // default silently failed the whole submission (the request never even reached the action),
    // which read as "I uploaded a logo, it disappeared" rather than a clear error.
    serverActions: {
      bodySizeLimit: '8mb'
    }
  }
  // No webpack() config: Turbopack is the default bundler as of Next.js 16,
  // and next build refuses to run if a custom webpack config is present (to
  // avoid silently ignoring it). The previous config here was a dev-only
  // Windows/antivirus file-watcher polling workaround (WATCH_POLL=true) —
  // Turbopack has no equivalent watchOptions.poll knob, so if the same
  // "changes compile but don't trigger reload" symptom recurs under
  // Turbopack, a manual browser refresh is the fallback until Turbopack adds
  // one.
};

export default nextConfig;
