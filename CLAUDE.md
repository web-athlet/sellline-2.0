# NextGen CRM — Claude Code Context

> **v4.2** | Stand: 2026-05-10 | Aktive Session: Session 4 (M8 Kontakte) | Branch: feature/session-4-contacts
> Letztes Update: 2026-05-10 (Session 3 Navigation / App-Shell)

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
| 2 | Authentication (JWT, RBAC, 2FA, PW-Reset) | ✅ | feature/session-2-authentication | 10/10 |
| 3 | Navigation / App-Shell | ✅ | feature/session-3-navigation | 10/10 |
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

**Identity & Auth:** `User`, `RefreshToken` (`replacedByToken` ergaenzt in `fix/session-1-security`), `PasswordReset`
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

1. **[Done] JWT-WS-Handshake** — In Session 2 implementiert: `EventsGateway.handleConnection` verifiziert `client.handshake.auth.token` (Fallback `Authorization: Bearer`) per `JwtService`, hängt `client.data.user` an, disconnected sonst. Inline-TODO entfernt.
2. **[Tech-Debt] Audit-Threshold auf `critical`** — Next.js 14.2.x CVE (GHSA-q4gf-8mx6-v5v3 DoS via Server Components). Wartet auf Next-15-Migration in Session 15. Threshold danach zurück auf `high`.
3. **[Tech-Debt] `vitest.workspace.ts` entfernt** — Pro-Package Coverage via Turbo; Quality-Gate-Regex matcht mehrere "All files"-Zeilen.
4. **[Info] `docs/.obsidian/` in `.gitignore`** — lokaler Editor-State, kein Repo-Inhalt.
5. **[Tech-Debt] Bare-FK-Spalten ohne Prisma-Relation** — `Email.userId` und `Task.assigneeId` sind plain `String`/`String?` ohne `@relation` (spec-treu). Kein FK-Constraint auf DB-Ebene. Tightening: `Email.userId` in Session 11 (E-Mail-Sync), `Task.assigneeId` in Session 10 (Projects). Kein BLOCKER.
6. **[Tech-Debt] `migrate dev` nur interaktiv** — Tool-Harness ohne TTY musste auf `prisma migrate diff --from-empty --to-schema-datamodel ... --script` + `prisma migrate deploy` ausweichen. Lokale Entwickler nutzen weiter `pnpm --filter @nextgen/db prisma:migrate` interaktiv. SQL-Output identisch. Kein BLOCKER. Hinweis: Gleiches Verfahren im Security-Fix-Branch (`fix/session-1-security`) erneut angewendet — `migration_lock.toml` musste manuell erstellt werden, da es im initialen Commit fehlte (`prisma migrate dev` haette es automatisch erzeugt).
7. **[Doc-Lücke] `.env`-Bootstrap fehlt im Onboarding** — `.env` ist gitignored und im Repo nicht vorhanden; muss vor erstem `prisma:migrate` via `cp .env.example .env` erstellt werden. Sollte ins zukünftige `docs/50-runbooks/local-dev-setup.md` aufgenommen werden.
8. **[Done] Tier-3 Deep-Review Session 1** — 4 BLOCKER: 2 echte (S1 bcrypt cost 10→12 in `seed.ts:73`; S4 NODE_ENV-Prod-Seed-Guard mit `exit 1`, override via `SEED_ALLOW_PROD=1`), 1 partial-FP (S3 `revokedAt` war da, `replacedByToken String?` fehlte — ergaenzt), 1 FP (S2 `tokenHash` war bereits implementiert). Fix-Branch: `fix/session-1-security`. Migration: `20260509170000_add_refresh_token_replaced_by`. Quality-Gate gruen (typecheck PASS, lint PASS, vitest 3/3 PASS). Review-Dokument: `docs/30-reviews/session-1-deep-review.md`.
9. **[Tech-Debt] Deep-Review-Session-1-Findings (offen, kein BLOCKER)** — geplant fuer Folge-Sessions:
   - S5 HMAC-Tracking-Token in `CampaignContact.trackingToken` (Session 12)
   - P1/P2/P3 Fehlende Indexe auf `Deal`, `Activity`, `Email` (Session 5/7/11)
   - P6 HNSW-Index fuer `Organization.enrichmentEmbedding` (Session 14)
   - D1 `AIInsight.deletedAt` + Index (Session 14)
   - D2 Retention-Felder `retainUntil` (Session 15)
   - D3 `Person.optOutAt` (Session 12)
   - D4 `onDelete: Cascade` fuer Kindelemente (Session 5/12)
   - A1 Singleton-Disconnect-Lifecycle fuer PrismaClient (Session 2 / PrismaService)
   - T2/T3 Test-Coverage: Seed-Idempotenz + Disconnect-Order (Session 16a)
10. **[Tech-Debt Session 3] Badge-Counts Placeholder** — `inboxCount`/`overdueCount` props in NavRail default 0. Echte API-Anbindung: Session 11 (Inbox) und Session 7 (Aktivitäten).
11. **[Tech-Debt Session 3] Bell-Button ohne Handler** — Notifications-Bell hat keinen onClick. Geplant Session 6/7.
12. **[Tech-Debt Session 3] `settings/security` ohne DashboardLayout** — Seite nutzt noch kein App-Shell-Layout. Refactoring in Session 4 oder eigenem PR.

---

## Aktuelle Session-Notizen
<!-- Wird bei /session-end überschrieben. Enthält In-Progress-Details. -->
Aktive Session: Session 4 (M8 Kontakte).

**Voraussetzungen erfüllt (aus Session 3):**
- `DashboardLayout` mit optionalem `sidebar`-Prop bereit (`components/layout/DashboardLayout.tsx`)
- `/contacts`-Stub unter `app/(dashboard)/contacts/page.tsx` vorhanden
- `useSession()` für RBAC-Guards, `apiFetch()` für HTTP-Aufrufe (beide aus Session 2)
- Design-Tokens und Tailwind-Theme-Extension aus Session 3 verfügbar

**Session 3 abgeschlossen:** NavRail (60/220px), DashboardLayout, 10 Stub-Pages, Zustand-UIStore, Mobile Bottom-Nav + Sheet. 45 Web-Tests, 99.8% Coverage. Kein Schema-Delta, keine neuen Env-Vars.
→ Details: [docs/20-sessions/session-03-summary.md](docs/20-sessions/session-03-summary.md)

**Tests:** 97 API-Tests (97% Coverage), 14 Web-Tests (100% Coverage).

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
| `JWT_SECRET` | JWT Signing Secret (≥32 chars) — signiert access/pre-2fa/setup-2fa Tokens | 2 |
| `JWT_ACCESS_TTL` | Access-Token TTL (default `15m`, vercel/ms-Format) | 2 |
| `JWT_REFRESH_TTL` | Refresh-Token TTL (default `30d`) | 2 |
| `NEXTAUTH_SECRET` | NextAuth Session-JWT Secret (≥32 chars) | 2 |
| `NEXTAUTH_URL` | App Base URL für NextAuth Callback-URLs | 2 |
| `ENCRYPTION_KEY` | AES-256-GCM Key — exakt 64 Hex-Chars (= 32 Byte). Verschlüsselt OAuth-Tokens + 2FA-Secrets. Verlust bricht alle 2FA + OAuth-Verknüpfungen. | 2 |
| `COOKIE_DOMAIN` | Optionale Cookie-Domain für Refresh-Token-Cookie. Leer = aktueller Host. | 2 |
| `GOOGLE_OAUTH_CLIENT_ID` | Google OAuth Client ID (optional — ohne Wert sind /auth/google-Routen 503) | 2 |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google OAuth Client Secret | 2 |
| `GOOGLE_OAUTH_CALLBACK_URL` | Google OAuth Callback URL | 2 |
| `MICROSOFT_OAUTH_CLIENT_ID` | Microsoft OAuth Client ID (optional) | 2 |
| `MICROSOFT_OAUTH_CLIENT_SECRET` | Microsoft OAuth Client Secret | 2 |
| `MICROSOFT_OAUTH_CALLBACK_URL` | Microsoft OAuth Callback URL | 2 |
| `SEED_ALLOW_PROD` | Prod-Seed-Guard-Override (setze `1` um Seed in production zu erzwingen — sonst exit 1) | 1-fix |
| _(weitere folgen pro Session)_ | | |

---

## Schnell-Links
- [Alle Module](docs/10-modules/) | [Sessions](docs/20-sessions/) | [Reviews](docs/30-reviews/)
- [Entscheidungen (ADRs)](docs/40-decisions/) | [Runbooks](docs/50-runbooks/)
- [KI-Prompts](docs/60-prompts/) | [Doc-Index](docs/99-index.md)
- [Quality-Gate](scripts/quality-gate.sh) | [Glossar](docs/00-overview/glossary.md)
