# syntax=docker/dockerfile:1
# Build context MUST be the monorepo root (pnpm workspace):
#   docker build -f apps/web/Dockerfile -t nextgen-web .
ARG NODE_VERSION=20-alpine

FROM node:${NODE_VERSION} AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# ---- deps: install only what @nextgen/web needs (manifests first for caching) ----
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/types/package.json packages/types/
COPY packages/utils/package.json packages/utils/
COPY packages/db/package.json packages/db/
# --ignore-scripts skips @nextgen/db's `prisma generate` postinstall — the web app
# never imports Prisma, so we don't drag the engine into this image. Full (non-prod)
# install: next build needs the devDeps (next, tailwind, typescript).
RUN pnpm install --frozen-lockfile --ignore-scripts --filter "@nextgen/web..."

# ---- builder: compile the standalone bundle ----
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .
RUN pnpm --filter @nextgen/web build

# ---- runner: minimal standalone runtime ----
FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# next.config sets `output: 'standalone'` + experimental.outputFileTracingRoot = repo
# root, so the standalone tree mirrors the monorepo: server.js lives at apps/web/.
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
# Liveness/readiness target for K8s: GET /api/health (Next route handler).
CMD ["node", "apps/web/server.js"]
