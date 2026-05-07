---
title: "Tech-Stack NextGen CRM"
tags: [tech-stack, dependencies, versions]
status: active
last_updated: 2026-05-07
summary: "Vollständiger Tech-Stack: Next.js 14, NestJS 10, Postgres 15, Redis 7, BullMQ 5, Socket.io 4, GPT-4o, Serper.dev."
---

# Tech-Stack — NextGen CRM

## Kern-Dependencies

| Schicht | Paket | Version | Begründung |
|---------|-------|---------|------------|
| **Frontend** | next | ^14.x | App Router, SSR, optimale Performance |
| | react | ^18.x | Server Components |
| | tailwindcss | ^3.x | Utility-first |
| | @shadcn/ui | latest | Konsistentes Design-System |
| | zustand | ^4.x | Lokaler State (leichtgewichtig) |
| | @tanstack/react-query | ^5.x | Server-State, Cache, Optimistic UI |
| | @dnd-kit/core | ^6.x | Drag-and-Drop (Kanban) |
| | @dnd-kit/sortable | ^8.x | Sortierbare Listen |
| | socket.io-client | ^4.x | WebSocket-Client |
| | react-grid-layout | ^1.x | Insights-Dashboard-Builder |
| | recharts | ^2.x | Charts im Dashboard |
| | isomorphic-dompurify | ^2.x | HTML-Sanitizer (XSS-Schutz) |
| | next-pwa | ^5.x | PWA-Support |
| **Backend** | @nestjs/core | ^10.x | DI, Modularität, TypeScript |
| | @nestjs/jwt | ^10.x | JWT-Generierung/-Validierung |
| | @nestjs/throttler | ^5.x | Rate-Limiting |
| | @nestjs/bull | ^10.x | BullMQ-Integration |
| | bullmq | ^5.x | Job-Queues für KI-Worker |
| | socket.io | ^4.x | WebSocket-Server |
| | csrf-csrf | ^3.x | CSRF-Schutz (Double-Submit) |
| | zod | ^3.x | Input-Validation |
| | pino | ^8.x | Strukturiertes Logging |
| **Datenbank** | @prisma/client | ^5.x | Type-safe ORM |
| | prisma | ^5.x | Schema + Migrations |
| | pg | ^8.x | Postgres-Treiber |
| **Auth** | next-auth | ^4.x | OAuth2 (Gmail, Outlook) |
| | speakeasy | ^2.x | TOTP 2FA |
| | bcrypt | ^5.x | Password-Hashing |
| **KI/API** | openai | ^4.x | GPT-4o API |
| | cheerio | ^1.x | HTML-Parsing (Enrichment) |
| | robots-parser | ^3.x | Robots.txt-Prüfung |
| **Testing** | vitest | ^1.x | Unit + Integration Tests |
| | @vitest/coverage-v8 | ^1.x | Coverage-Reports |
| | vitest-mock-extended | ^1.x | Prisma-Mocking |
| | @playwright/test | ^1.x | E2E-Tests |
| | fishery | ^2.x | Test-Data-Factories |
| | @faker-js/faker | ^8.x | Fake-Daten für Tests |
| | testcontainers | ^10.x | Echter Postgres in Tests |
| **DevOps** | turbo | ^2.x | Monorepo-Build-Orchestration |
| | pnpm | ^9.x | Package-Manager |
| | husky | ^9.x | Git-Hooks |
| | lint-staged | ^15.x | Pre-Commit Linting |

## Externe Dienste

| Dienst | Zweck | Env-Var | DSGVO |
|--------|-------|---------|-------|
| OpenAI GPT-4o | Enrichment-Extraktion, Thread-Summary, Betreffzeilen-KI | `OPENAI_API_KEY` | ⚠️ US-Service — nur anonymisierte Snippets senden, keine PII |
| Serper.dev | Web-Search für Enrichment | `SERPER_API_KEY` | ⚠️ US-Service — nur Firmenname/Domain senden |
| Gmail API (GCP) | E-Mail-Sync via Watch/historyId | `GOOGLE_CLIENT_ID/SECRET` | ✅ EU-kompatibel via AV-Vertrag |
| Microsoft Graph | Outlook-E-Mail-Sync | `AZURE_CLIENT_ID/SECRET` | ✅ EU-Region |
| MinIO (self-hosted) | S3-kompatibler Datei-Storage | `MINIO_*` | ✅ EU-only |
| SendGrid/Brevo | Campaign-E-Mail-Versand | `EMAIL_PROVIDER_API_KEY` | Muss EU-AV-Vertrag haben |

## Claude Code Konfiguration

| Parameter | Wert | Datei |
|-----------|------|-------|
| Mindestversion | v2.1.111 | — |
| Default-Modell | `opusplan` | claude update → settings |
| Default-Effort | `high` | /effort high |
| Subagents | architect, reviewer, tester, doc-keeper | .claude/agents/ |
| Custom Commands | 6 | .claude/commands/ |
| Modell kritische Sessions | `claude-opus-4-7` | Session-spezifisch |
| Modell Standard-Sessions | `claude-sonnet-4-6` | Session-spezifisch |
