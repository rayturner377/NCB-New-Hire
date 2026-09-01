FROM node:20-bookworm-slim

ENV NODE_ENV=production

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages ./packages

RUN npm ci --omit=dev

COPY database ./database
COPY public ./public
COPY scripts ./scripts
COPY server.js ./

EXPOSE 8080

CMD ["node", "server.js"]
