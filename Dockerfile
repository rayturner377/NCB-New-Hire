# Multi-stage build: the `builder` stage needs the full dev toolchain (turbo, typescript,
# dotenv-cli) to run `npm run build`; the final `runner` stage installs production dependencies
# only and copies over just the compiled output, so devDependencies and build-time tooling never
# ship in the image that actually runs in production.

FROM node:20-bookworm-slim AS builder

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
# be present and syntactically valid to satisfy that, and only exist in this
# builder stage — the runner stage below never inherits them, so the known
# BETTER_AUTH_SECRET literal never ships in the final image's layers/env.
ENV BETTER_AUTH_SECRET=docker-build-placeholder-overridden-at-runtime
ENV REDIS_URL=redis://placeholder:6379
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public
RUN npm run build

FROM node:20-bookworm-slim AS runner

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Only set before install: npm skips devDependencies (turbo, dotenv-cli,
# typescript — everything the builder stage's build step needed, none of
# which the running app needs) when NODE_ENV=production is already set at
# install time.
ENV NODE_ENV=production

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

# Only the compiled/generated output — never the builder stage's source .ts files, its
# devDependency-only node_modules, or the placeholder secrets set as ENV in that stage (ENV values
# don't carry across a new FROM, so they simply don't exist here).
COPY --from=builder /app/apps/web/.next apps/web/.next
COPY --from=builder /app/packages/database/dist packages/database/dist
# Prisma's generated client resolves its native query engine binary via a hardcoded absolute
# fallback path pointing at the schema's configured generator output (packages/database/src/generated/client)
# — a real fallback candidate baked in at generate time, not just a debug string — because
# Turbopack's bundling of the client into .next's own chunks breaks its normal __dirname-relative
# lookup. Without this directory also present here at that exact path, the query engine binary
# (which does exist under dist/generated/client, copied above) can't be found at runtime, and every
# database call fails with PrismaClientInitializationError.
COPY --from=builder /app/packages/database/src/generated packages/database/src/generated
# The migrate service (docker-compose.yml) shares this same image, running
# `npm run migrate:deploy -w @ncb/database` (`prisma migrate deploy`), which
# reads the schema/migrations directly — the compiled dist/ output above
# doesn't include these, only the generated client does.
COPY --from=builder /app/packages/database/prisma packages/database/prisma
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/auth/dist packages/auth/dist
COPY --from=builder /app/packages/redis/dist packages/redis/dist

# Runs as the non-root `node` user the base image already provides (uid/gid 1000), rather than the
# default root — chown the files this user needs to read/write: the app source copied above, and
# the bind-mounted data/ directory (attachments, the local master-key fallback) docker-compose.yml
# maps in for the web service.
RUN mkdir -p /app/apps/web/data && chown -R node:node /app
USER node

EXPOSE 3000

CMD ["npm", "run", "start", "-w", "@ncb/web"]
