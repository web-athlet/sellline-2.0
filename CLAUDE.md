# NextGen CRM — Claude Code Context

> **v4.0** | Stand: 2026-05-09 | Aktive Session: — | Branch: feature/session-1-db-schema
> Letztes Update: 2026-05-09 (Session 1 Closer)

## Mission
AI-natives B2B-CRM mit 10 Modulen + 3 KI-Agenten. Orientiert an Pipedrive,
erweitert um GPT-4o-Enrichment, regelbasiertes Scoring und Ghosting-Detection.
DSGVO-konform, EU-only, AES-256-GCM E-Mail-Verschlüsselung.

→ Vollständige Architektur: [docs/00-overview/architecture.md](docs/00-overview/architecture.md)
→ Vollständiger Tech-Stack: [docs/00-overview/tech-stack.md](docs/00-overview/tech-stack.md)

---

## Monorepo-Struktur

```
nextgen-crm/
├── apps/
│   ├── web/          # Next.js 14 — Port 3000
│   └── api/          # NestJS 10 — Port 3001
├── packages/
│   ├── db/           # Prisma 5 Schema + Migrations
│   ├── types/        # Shared TypeScript Types
│   └── utils/        # Shared Utilities (date, crypto, validation)
├── docs/             # Second Brain — IMMER aktuell halten
├── .claude/          # Subagents + Slash-Commands
└── scripts/          # Quality-Gate, Index-Update
```

---

## Session-Status (von @doc-keeper gepflegt)

| # | Modul | Status | Branch | AC-Coverage |
|---|-------|--------|--------|-------------|
| 0 | Scaffolding + CLAUDE.md + WebSocket-Basis | ✅ | feature/session-0-scaffolding | 14/14 (Selbstcheck) |
| 1 | DB-Schema + Prisma + Seed | ✅ | feature/session-1-db-schema | 11/11 |
| 2 | Authentication (JWT, RBAC, 2FA, PW-Reset) | ⬜ | — | — |
| 3 | Navigation / App-Shell | ⬜ | — | — |
| 4 | M8 Kontakte | ⬜ | — | — |
| 5 | M3 Deals — Kritischer Pfad | ⬜ | — | — |
| 6 | M1 Pulse-Feed | ⬜ | — | — |
| 7 | M7 Aktivitäten | ⬜ | — | — |
| 8 | M2 Leads & Webformulare | ⬜ | — | — |
| 9 | M10 Produktkatalog | ⬜ | — | — |
| 10 | M4 Projekte | ⬜ | — | — |
| 11 | M6 E-Mail-Sync — Kritischer Pfad | ⬜ | — | — |
| 12 | M5 E-Mail-Campaigns | ⬜ | — | — |
| 13 | M9 Insights & Analytics | ⬜ | — | — |
| 14 | KI-Agenten (Enrichment, Scoring, Ghosting) | ⬜ | — | — |
| 15 | Security & DSGVO-Härtung | ⬜ | — | — |
| 16a | Testing & Performance | ⬜ | — | — |
| 16b | PWA & CI/CD | ⬜ | — | — |

⬜ TODO | 🔄 IN PROGRESS | ✅ DONE | 🔴 BLOCKED

---

## Kritische Konventionen (immer einhalten)

### Git
- Branch: `feature/session-{N}-{kurzname}` (von `main` branchen)
- Commits: `feat(session-N): kurzbeschreibung` | `fix:` | `test:` | `docs:`
- **Niemals direkt auf `main` pushen** — immer PR + CI grün
- Nach jeder Session: PR öffnen, Light-Review, dann mergen

### TypeScript
- `strict: true` in tsconfig — kein `any` ohne `// eslint-disable`-Kommentar
- Zod-Schema für ALLE User-Inputs an API-Grenzen
- Prisma-Queries: IMMER `deletedAt: null` in WHERE-Clause

### Security (nie vergessen)
- Alle User-HTML durch DOMPurify (Campaigns, Form-Builder, Rich-Text)
- HMAC-signierte Tracking-Tokens — keine reinen UUIDs
- `optIn: true` Pflicht vor jedem Campaign-Versand
- Keine PII in Logs (email, name, phone)
- CSRF-Token bei allen Non-GET-Requests (außer Bearer-Auth)

### Naming
- Dateien: `kebab-case.ts` | Klassen: `PascalCase` | DB: `snake_case`
- Env-Vars: `SCREAMING_SNAKE_CASE` (alle in `.env.example` dokumentiert)

---

## Implementierte Prisma-Entities (von @doc-keeper gepflegt)
<!-- Stand: Session 1 — alle 19 Models + 7 Enums via 20260509153907_init deployed. -->

**Identity & Auth:** `User`, `RefreshToken`, `PasswordReset`
**Pipeline & Deals:** `Pipeline`, `Stage`, `Deal`
**Contacts:** `Organization`, `Person`
**Activities:** `Activity`
**Email:** `Email`
**Products:** `Product`, `DealProduct`
**Leads & Forms:** `Lead`, `Form`
**Campaigns:** `Campaign`, `CampaignContact`
**Projects:** `Project`, `Task`, `ProjectTemplate`
**AI & Audit:** `AIInsight`, `AuditLog`

**Enums:** `Role`, `ActivityType`, `Priority`, `DiscountType`, `EnrichmentStatus`, `CampaignStatus`, `ProjectStatus`

**pgvector:** `Organization.enrichmentEmbedding vector(1536)` (Extension v0.8.2 installiert).

---

## Bekannte Offene Punkte / BLOCKER
<!-- @doc-keeper aktualisiert nach jedem Review -->

1. **[Tech-Debt] JWT-WS-Handshake fehlt** — Inline-TODO im Gateway: `// TODO(session-2): JWT-Handshake-Guard einbauen`. Kein BLOCKER bis Session 2.
2. **[Tech-Debt] Audit-Threshold auf `critical`** — Next.js 14.2.x CVE (GHSA-q4gf-8mx6-v5v3 DoS via Server Components). Wartet auf Next-15-Migration in Session 15. Threshold danach zurück auf `high`.
3. **[Tech-Debt] `vitest.workspace.ts` entfernt** — Pro-Package Coverage via Turbo; Quality-Gate-Regex matcht mehrere "All files"-Zeilen.
4. **[Info] `docs/.obsidian/` in `.gitignore`** — lokaler Editor-State, kein Repo-Inhalt.
5. **[Tech-Debt] Bare-FK-Spalten ohne Prisma-Relation** — `Email.userId` und `Task.assigneeId` sind plain `String`/`String?` ohne `@relation` (spec-treu). Kein FK-Constraint auf DB-Ebene. Tightening: `Email.userId` in Session 11 (E-Mail-Sync), `Task.assigneeId` in Session 10 (Projects). Kein BLOCKER.
6. **[Tech-Debt] `migrate dev` nur interaktiv** — Tool-Harness ohne TTY musste auf `prisma migrate diff --from-empty --to-schema-datamodel ... --script` + `prisma migrate deploy` ausweichen. Lokale Entwickler nutzen weiter `pnpm --filter @nextgen/db prisma:migrate` interaktiv. SQL-Output identisch. Kein BLOCKER.
7. **[Doc-Lücke] `.env`-Bootstrap fehlt im Onboarding** — `.env` ist gitignored und im Repo nicht vorhanden; muss vor erstem `prisma:migrate` via `cp .env.example .env` erstellt werden. Sollte ins zukünftige `docs/50-runbooks/local-dev-setup.md` aufgenommen werden.

---

## Aktuelle Session-Notizen
<!-- Wird bei /session-end überschrieben. Enthält In-Progress-Details. -->
_Keine aktive Session._

---

## Env-Variablen (kumulativ, von @doc-keeper gepflegt)

| Variable | Beschreibung | Seit Session |
|----------|--------------|--------------|
| `DATABASE_URL` | PostgreSQL + pgvector Connection String | 0 |
| `REDIS_URL` | Redis Connection String | 0 |
| `MINIO_ENDPOINT` | MinIO S3-kompatibler Endpoint | 0 |
| `MINIO_ACCESS_KEY` | MinIO Access Key | 0 |
| `MINIO_SECRET_KEY` | MinIO Secret Key | 0 |
| `MINIO_BUCKET` | MinIO Bucket-Name | 0 |
| `NEXT_PUBLIC_API_URL` | Web → API HTTP-Basis-URL | 0 |
| `NEXT_PUBLIC_WS_URL` | Web → API WebSocket-URL | 0 |
| `JWT_SECRET` | JWT Signing Secret (≥32 chars) | 2 |
| `NEXTAUTH_SECRET` | NextAuth Secret | 2 |
| `NEXTAUTH_URL` | App Base URL | 2 |
| _(weitere folgen pro Session)_ | | |

---

## Schnell-Links
- [Alle Module](docs/10-modules/) | [Sessions](docs/20-sessions/) | [Reviews](docs/30-reviews/)
- [Entscheidungen (ADRs)](docs/40-decisions/) | [Runbooks](docs/50-runbooks/)
- [KI-Prompts](docs/60-prompts/) | [Doc-Index](docs/99-index.md)
- [Quality-Gate](scripts/quality-gate.sh) | [Glossar](docs/00-overview/glossary.md)
