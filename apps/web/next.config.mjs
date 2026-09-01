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
  reactStrictMode: true
};

export default nextConfig;
