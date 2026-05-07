# NextGen CRM — Claude Code Context

> **v4.0** | Stand: _{DATUM}_ | Aktive Session: _{N}_ | Branch: _{BRANCH}_
> Letztes Update: _{SESSION-CLOSER-TIMESTAMP}_

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
| 0 | Scaffolding + CLAUDE.md + WebSocket-Basis | ⬜ | — | — |
| 1 | DB-Schema + Prisma + Seed | ⬜ | — | — |
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
<!-- Nach Session 1 füllt @doc-keeper diese Liste -->
_Noch nicht implementiert._

---

## Bekannte Offene Punkte / BLOCKER
<!-- @doc-keeper aktualisiert nach jedem Review -->
_Keine._

---

## Aktuelle Session-Notizen
<!-- Wird bei /session-end überschrieben. Enthält In-Progress-Details. -->
_Keine aktive Session._

---

## Env-Variablen (kumulativ, von @doc-keeper gepflegt)

| Variable | Beschreibung | Seit Session |
|----------|--------------|--------------|
| `DATABASE_URL` | PostgreSQL Connection String | 1 |
| `REDIS_URL` | Redis Connection String | 1 |
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
