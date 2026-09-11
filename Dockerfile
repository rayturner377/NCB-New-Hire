FROM node:20-bookworm-slim

# node:20-bookworm-slim ships without openssl, so Prisma's "native" engine
# detection can't find a libssl to inspect and falls back to a wrong guess
# (debian-openssl-1.1.x) instead of bookworm's actual OpenSSL 3.x, which then
# fails to load at runtime. Installing it lets Prisma detect correctly.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy every workspace's package.json first (not just the root) so `npm ci`
# can resolve the full workspace tree, while keeping this layer cached
# across builds that only change source, not dependencies.
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/redis/package.json packages/redis/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/tsconfig/package.json packages/tsconfig/package.json
COPY packages/vitest-config/package.json packages/vitest-config/package.json

RUN npm ci

COPY . .

# turbo run build: prisma generate + tsc for @ncb/database, tsc for
# @ncb/shared, next build for @ncb/web. prisma generate only reads the
# schema file, so no DATABASE_URL is needed at build time.
#
# next build's "Collecting page data" step imports every route module
# (including ones that reach @ncb/auth and @ncb/redis) to inspect it, even
# though it never actually calls an auth/session function — but @ncb/auth
# constructs its betterAuth() instance eagerly at module scope, and
# @ncb/redis constructs its ioredis client eagerly too, so both throw
# immediately if BETTER_AUTH_SECRET/REDIS_URL are unset, regardless of
# whether anything real happens with them. These placeholders only need to
# be present and syntactically valid to satisfy that — same reasoning as
# ci.yml's placeholder DATABASE_URL for the build-test-lint job. Always
# overridden by the real values from .env at container runtime (see
# docker-compose.yml's web service's env_file/environment).
ENV BETTER_AUTH_SECRET=docker-build-placeholder-overridden-at-runtime
ENV REDIS_URL=redis://placeholder:6379
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public
RUN npm run build

# Only set after install/build: npm skips devDependencies (turbo, dotenv-cli,
# typescript — everything the build step above needs) when NODE_ENV=production
# is already set at install time.
ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "run", "start", "-w", "@ncb/web"]
