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
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/tsconfig/package.json packages/tsconfig/package.json
COPY packages/vitest-config/package.json packages/vitest-config/package.json

RUN npm ci

COPY . .

# turbo run build: prisma generate + tsc for @ncb/database, tsc for
# @ncb/shared, next build for @ncb/web. prisma generate only reads the
# schema file, so no DATABASE_URL is needed at build time.
RUN npm run build

# Only set after install/build: npm skips devDependencies (turbo, dotenv-cli,
# typescript — everything the build step above needs) when NODE_ENV=production
# is already set at install time.
ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "run", "start", "-w", "@ncb/web"]
