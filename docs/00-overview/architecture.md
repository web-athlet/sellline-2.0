---
title: "System-Architektur NextGen CRM"
tags: [architecture, overview, system-design]
status: active
last_updated: 2026-05-07
summary: "Monorepo-Architektur: Next.js Frontend + NestJS API + Postgres/Redis + 3 BullMQ-Worker. EU-only, DSGVO-konform."
---

# System-Architektur — NextGen CRM

## Überblick

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER / PWA                           │
│  Next.js 14 (App Router, SSR)  ←→  Socket.io Client            │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTPS / WSS (TLS 1.3)
┌────────────────────────▼────────────────────────────────────────┐
│                      NestJS API (Port 3001)                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │ Auth     │ │ REST API │ │ WS-GW    │ │ BullMQ Queues    │  │
│  │ (JWT+    │ │ /api/v1/ │ │ Socket.  │ │ enrichment       │  │
│  │  NextAuth│ │          │ │ io       │ │ deal-scoring     │  │
│  └──────────┘ └──────────┘ └──────────┘ │ ghosting-detect  │  │
│                                          └──────────────────┘  │
└───┬──────────────┬──────────────┬───────────────────┬──────────┘
    │              │              │                   │
┌───▼───┐   ┌──────▼─────┐  ┌───▼────┐   ┌──────────▼────────┐
│Postgres│   │   Redis 7  │  │ MinIO  │   │  Externe APIs     │
│  15   │   │ Cache+Queue│  │  S3    │   │  - OpenAI GPT-4o  │
│+pgvec │   └────────────┘  └────────┘   │  - Serper.dev     │
│ tor   │                                │  - Gmail OAuth    │
└───────┘                                │  - MS Graph API   │
                                         └───────────────────┘
```

## Monorepo-Struktur (Turborepo)

```
nextgen-crm/
├── apps/
│   ├── web/                    # Next.js 14 Frontend
│   │   ├── app/                # App Router Pages
│   │   │   ├── (auth)/         # Login, Register, Reset
│   │   │   ├── (dashboard)/    # Alle CRM-Seiten
│   │   │   │   ├── pulse/      # M1
│   │   │   │   ├── leads/      # M2
│   │   │   │   ├── deals/      # M3
│   │   │   │   ├── projects/   # M4
│   │   │   │   ├── campaigns/  # M5
│   │   │   │   ├── inbox/      # M6
│   │   │   │   ├── activities/ # M7
│   │   │   │   ├── contacts/   # M8
│   │   │   │   ├── insights/   # M9
│   │   │   │   └── products/   # M10
│   │   │   └── api/            # Next.js API Routes (NextAuth)
│   │   ├── components/
│   │   │   ├── ui/             # shadcn/ui Komponenten
│   │   │   ├── modules/        # Modul-spezifische Komponenten
│   │   │   └── shared/         # Nav, Layout, PWAUpdatePrompt
│   │   ├── lib/
│   │   │   ├── api-client.ts   # Axios-Instanz mit JWT-Interceptor
│   │   │   ├── sanitize.ts     # DOMPurify-Wrapper
│   │   │   └── socket.ts       # Socket.io Client-Init
│   │   └── middleware.ts       # Security-Headers, CSRF, CSP
│   │
│   └── api/                    # NestJS 10 Backend
│       └── src/
│           ├── main.ts         # Bootstrap, CORS, CSRF, Swagger
│           ├── app.module.ts   # Root-Module
│           ├── auth/           # JWT, Guards, Strategies, 2FA
│           ├── websocket/      # Socket.io Gateway (ab Session 0!)
│           ├── pulse/          # M1
│           ├── leads/          # M2
│           ├── deals/          # M3
│           ├── projects/       # M4
│           ├── campaigns/      # M5
│           ├── email/          # M6
│           ├── activities/     # M7
│           ├── contacts/       # M8
│           ├── insights/       # M9
│           ├── products/       # M10
│           ├── ai/             # GPT-4o Prompts + Enrichment
│           ├── queues/         # BullMQ Worker-Definitionen
│           ├── audit/          # AuditLog-Interceptor
│           ├── gdpr/           # Export, Hard-Delete-Cron
│           ├── prisma/         # PrismaService (Singleton)
│           └── common/         # Guards, Interceptors, Pipes, Filters
│
├── packages/
│   ├── db/                     # Prisma Schema + Migrations
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts         # Idempotentes Seed-Script
│   │   └── index.ts            # PrismaClient-Export
│   ├── types/                  # Shared TypeScript Interfaces
│   │   └── src/
│   │       ├── models/         # CRM-Entitäten als TS-Types
│   │       ├── api/            # Request/Response-Types
│   │       └── events/         # WebSocket-Event-Types
│   └── utils/                  # Shared Utilities
│       └── src/
│           ├── crypto.ts       # AES-256-GCM, HMAC-Funktionen
│           ├── date.ts         # date-fns Wrapper
│           └── validation.ts   # Zod-Schemas (shared)
│
├── docs/                       # Second Brain (dieses Verzeichnis)
├── .claude/                    # Subagents + Slash-Commands
├── k8s/                        # Kubernetes-Manifeste (Session 16b)
├── e2e/                        # Playwright E2E-Tests
├── k6/                         # Performance-Tests
└── scripts/                    # quality-gate.sh, update-index.sh
```

## Datenflüsse

### Auth-Flow
```
Browser → POST /api/auth/login
        ← JWT Access (15 min, Response-Body)
        ← Refresh Token (30 Tage, HttpOnly-Cookie)
Browser → Alle API-Calls: Authorization: Bearer {access_token}
        → Refresh: POST /api/auth/refresh (Cookie automatisch mitgeschickt)
```

### WebSocket-Flow (Pflicht ab Session 0)
```
Browser → Socket.io Handshake: { auth: { token: jwt } }
        ← Connected / Error: 401 Unauthorized
Browser ← deal.created | deal.updated | activity.created | pulse.update
```

### KI-Enrichment-Flow
```
Lead.created → BullMQ Queue "enrichment"
             → Serper.dev API (Firma suchen)
             → HTTP-Fetch + Cheerio (Website scrapen)
             → GPT-4o API (JSON extrahieren)
             → leads.enriched_json updaten
             → AIInsight erstellen (inkl. cost tracking)
```

## Security-Architektur

| Layer | Schutzmechanismus |
|-------|-------------------|
| Transport | TLS 1.3, HSTS, keine HTTP |
| Auth | JWT 15min + Refresh-Rotation, 2FA TOTP |
| API | Rate-Limiting (@nestjs/throttler + Redis), CSRF (csrf-csrf) |
| Input | Zod-Validation alle Endpoints, DOMPurify User-HTML |
| Tokens | HMAC-signiert (Tracking, Unsubscribe, Export-Links) |
| Daten | AES-256 DB, AES-256-GCM E-Mail-Bodies |
| Audit | AuditLog alle Mutationen, 7 Jahre Retention |
| Scan | Dependabot täglich, Snyk bei jedem PR |

## Kritische Abhängigkeiten zwischen Modulen

```
M8 (Kontakte) ──┬──► M3 (Deals) ──┬──► M1 (Pulse-Feed)
                │                  ├──► M7 (Aktivitäten)
M2 (Leads) ─────┘                  └──► M6 (E-Mail)
                                         │
                                         ▼
                                    M5 (Campaigns)
                                    M9 (Insights) ◄── alle Module
```

M8 + M3 = Kritischer Pfad. Müssen vor allen anderen Modulen fertig sein.
