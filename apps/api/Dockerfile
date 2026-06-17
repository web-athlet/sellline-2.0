# syntax=docker/dockerfile:1
# Build context MUST be the monorepo root (pnpm workspace):
#   docker build -f apps/api/Dockerfile -t nextgen-api .
#
# KNOWN ISSUE (TD-S16b-01) — THIS IMAGE DOES NOT START YET AS WRITTEN.
# @nextgen/db|types|utils expose TS source via `main: ./src/index.ts`. swc/vitest/
# Next transpile that on the fly, but `nest build` (swc builder) does NOT bundle —
# the emitted dist/main.js still `require()`s the workspace packages, which resolve
# to their TS `main`. A plain `node dist/main.js` cannot require TS, so it crashes on
# the first workspace import. We ship the package SOURCE here so the fix is a one-step
# follow-up, but there is NO TS runtime hook registered (the CMD is bare node).
# Before any real deploy, EITHER precompile the packages to JS (add `build` +
# `exports.import/require` to each — the clean fix, Session 17) OR register a runtime
# hook (e.g. `node -r @swc/register dist/main.js`) and add it to the image. See runbook.
ARG NODE_VERSION=20-alpine

FROM node:${NODE_VERSION} AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# openssl: Prisma query engine needs it on Alpine (musl).
RUN apk add --no-cache openssl && corepack enable
WORKDIR /app

# ---- deps ----
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/types/package.json packages/types/
COPY packages/utils/package.json packages/utils/
# Prisma schema must be present for the db postinstall (`prisma generate`).
COPY packages/db/prisma packages/db/prisma
RUN pnpm install --frozen-lockfile --filter "@nextgen/api..."

# ---- builder ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY . .
RUN pnpm --filter @nextgen/db exec prisma generate
RUN pnpm --filter @nextgen/api build

# ---- runner ----
FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs

COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./apps/api/package.json
# Workspace packages (TS source + generated Prisma client) — see TD-S16b-01 above.
COPY --from=builder --chown=nestjs:nodejs /app/packages ./packages

USER nestjs
EXPOSE 3001
ENV PORT=3001
# Readiness target for K8s: GET /api/health/ready (checks DB; 503 on failure).
CMD ["node", "apps/api/dist/main.js"]
