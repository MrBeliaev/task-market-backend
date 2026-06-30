FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json prisma.config.ts ./
RUN npm ci

COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src

# Generate the Prisma client (Prisma 7: prisma-client generator writes into
# src/generated/prisma) then compile everything into dist via tsc.
# prisma.config.ts resolves env("DATABASE_URL") even for generate, so a
# placeholder is supplied here; the real URL is injected at runtime.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate
RUN npm run build

# ── Migrator ──────────────────────────────────────────────────────────────────
# One-shot job that applies migrations. Keeps the prisma CLI + schema engine,
# which the runtime image below does not need.
FROM node:20-alpine AS migrator

WORKDIR /app

COPY package*.json prisma.config.ts ./
RUN npm ci
COPY prisma ./prisma

CMD ["npx", "prisma", "migrate", "deploy"]

# ── Runtime ───────────────────────────────────────────────────────────────────
# API server only. The PrismaPg driver adapter compiles queries in-process, so
# the prisma CLI and schema engine are removed to keep the image small.
FROM node:20-alpine AS runtime

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev \
  && rm -rf node_modules/prisma node_modules/@prisma/engines \
            node_modules/.bin/prisma node_modules/.bin/prisma2 \
  && npm cache clean --force

COPY --from=builder /app/dist ./dist

EXPOSE 3001

CMD ["node", "dist/index.js"]
