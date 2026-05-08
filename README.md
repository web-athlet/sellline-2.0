# NextGen CRM

AI-natives B2B-CRM mit 10 Modulen + 3 KI-Agenten. Monorepo (Turborepo + pnpm),
Next.js 14 Web + NestJS 10 API, Postgres 15 + pgvector, Redis, MinIO, Socket.io.

## Quick Start

```bash
# Voraussetzungen: Node 20 (siehe .nvmrc), Docker Desktop, pnpm 10 (via Corepack)
corepack enable
pnpm install

# Infrastruktur hochfahren
docker compose -f docker/docker-compose.yml up -d

# Apps starten (parallel via Turbo)
pnpm dev
# → Web:  http://localhost:3000
# → API:  http://localhost:3001  (Health: /health)
```

## Verifizieren

```bash
pnpm typecheck && pnpm lint && pnpm test --run && pnpm build
bash scripts/quality-gate.sh
```

## Docs

Architektur, Tech-Stack, Module, ADRs und Session-Summaries in [`docs/`](./docs/).
Claude-Code-Kontext: [`CLAUDE.md`](./CLAUDE.md).
