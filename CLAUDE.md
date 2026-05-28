# NextGen CRM — Claude Code Context

> **v4.10** | Stand: 2026-05-22 | Aktive Session: Session 12 (M5 E-Mail-Campaigns) | Branch: —
> Letztes Update: 2026-05-22 (Session 11 M6 E-Mail-Sync — vollständig)

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
| 4 | M8 Kontakte & Organisationen | ✅ | feature/session-4-contacts | 5/5 |
| 5 | M3 Deals — Kritischer Pfad | ✅ | feature/session-5-deals | 4/4 |
| 6 | M1 Pulse-Feed | ✅ | feature/session-6-pulse | 10/10 |
| 7 | M7 Aktivitäten + BookingModule | ✅ | feature/session-7-activities | 14/14 |
| 8 | M2 Leads & Webformulare | ✅ | feature/session-8-leads | 6/6 |
| 9 | M10 Produktkatalog | ✅ | feature/session-9-products | 4/4 |
| 10 | M4 Projekte | ✅ | feature/session-10-projects | 4/4 |
| 11 | M6 E-Mail-Sync — Kritischer Pfad | ✅ | feature/session-11-email | 4/4 |
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
**Booking:** `BookingConfig`
**AI & Audit:** `AIInsight`, `AuditLog`

**Enums:** `Role`, `ActivityType`, `Priority`, `DiscountType`, `EnrichmentStatus`, `CampaignStatus`, `ProjectStatus`, `DealStatus`

**pgvector:** `Organization.enrichmentEmbedding vector(1536)` (Extension v0.8.2 installiert).

---

## Bekannte Offene Punkte / BLOCKER
<!-- @doc-keeper aktualisiert nach jedem Review -->

1. **[Done] JWT-WS-Handshake** — In Session 2 implementiert: `EventsGateway.handleConnection` verifiziert `client.handshake.auth.token` (Fallback `Authorization: Bearer`) per `JwtService`, hängt `client.data.user` an, disconnected sonst. Inline-TODO entfernt.
2. **[Tech-Debt] Audit-Threshold auf `critical`** — Next.js 14.2.x CVE (GHSA-q4gf-8mx6-v5v3 DoS via Server Components). Wartet auf Next-15-Migration in Session 15. Threshold danach zurück auf `high`.
3. **[Tech-Debt] `vitest.workspace.ts` entfernt** — Pro-Package Coverage via Turbo; Quality-Gate-Regex matcht mehrere "All files"-Zeilen.
4. **[Info] `docs/.obsidian/` in `.gitignore`** — lokaler Editor-State, kein Repo-Inhalt.
5. **[Done Session 10] Bare-FK-Spalten ohne Prisma-Relation** — `Task.assigneeId` FK-Constraint via Migration `20260521120000_task_assignee_fk` ergänzt (ON DELETE SET NULL). `Email.userId` bleibt offen bis Session 11 (E-Mail-Sync).
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
11. **[Done Session 6] Bell-Button ohne Handler** — Bell-Button in NavRail mit `router.push('/pulse')` verdrahtet.
12. **[Tech-Debt Session 3] `settings/security` ohne DashboardLayout** — Seite nutzt noch kein App-Shell-Layout. Refactoring in Session 5 oder eigenem PR.
13. **[Tech-Debt Session 4] `DuplicateMergePanel.tsx` 0% Test-Coverage** — Komplexes State-Management, geplant Session 16a.
14. **[Tech-Debt Session 4] Detail-Tabs Placeholder** — `/contacts/[id]` Tabs Deals/Activities/Files/Emails zeigen Placeholder. Echte Anbindung: Sessions 5, 7, 11.
15. **[Tech-Debt Session 4] "Neuer Kontakt"-Button löst `alert()` aus** — Modal-Implementierung verschoben auf Session 5.
16. **[Tech-Debt Session 5] `deal-format.test.ts` nutzt echten System-Clock** — `new Date()` ohne Mock; fragile Tests. Geplant Session 16a.
17. **[Tech-Debt Session 5] Index-Migration ohne `CONCURRENTLY`** — `20260511120000_deals_order_score_closing` enthält `CREATE INDEX` ohne `CONCURRENTLY`. Bei Prod-Migration manuell als separate Migration ausführen. Geplant Session 15.
18. **[Tech-Debt Session 5/6] `providers.tsx` kein `staleTime`-Default** — WS-getriggerte Refetches entstehen (redundante HTTP-Calls nach jedem Event). Geplant Session 7 oder eigener PR.
19. **[Tech-Debt Session 5] `pipeline:subscribe` prüft Org-Zugehörigkeit nicht** — akzeptabel bei Single-Tenant; muss bei Multi-Tenancy (Session 15) via `prisma.pipeline.findFirst({ where: { id, orgId } })` geschützt werden.
20. **[Tech-Debt Session 6] Bell-Badge in NavRail nicht verdrahtet** — `GET /api/v1/pulse-feed/counts` bereit; Badge-Anbindung im NavRail geplant Session 7.
21. **[Tech-Debt Session 6] FeedList ohne IntersectionObserver** — Infinite-Scroll nur über "Mehr laden"-Button, kein Auto-Trigger. Geplant Session 16a.
22. **[Tech-Debt Session 6] RedisService ohne Circuit-Breaker** — fällt bei Verbindungsabbruch auf null/void zurück; kein dediziertes Circuit-Breaker-Pattern. Akzeptabel; Session 15.
23. **[Tech-Debt Session 7] BookingModule ohne Unit-Tests** — public endpoints brauchen Integration-Tests; vollständig aus Coverage-Scope ausgeschlossen. Geplant Session 16a.
24. **[Tech-Debt Session 7] ActivityCalendar ohne Unit-Tests** — react-big-calendar DnD braucht Browser-Events; aus Web-Coverage ausgeschlossen. Geplant Session 16a.
25. **[Tech-Debt Session 7] Web functions-Schwellwert auf 65% gesenkt** — V8 zählt JSX-Inline-Arrows als Functions. Review in Session 16a.
26. **[Tech-Debt Session 7] `activities/dto/**` + `booking/dto/**` aus API-Coverage ausgeschlossen** — class-validator DTOs ohne testbares Verhalten, analog zu `auth/dto`.
27. **[Tech-Debt Session 8] FormBuilder aus Web-Coverage ausgeschlossen** — `@dnd-kit` DnD-Interaktionen nicht unit-testbar. Geplant Session 16a.
28. **[Tech-Debt Session 8] Public Submit CORS nur via `@Header` Override** — `Access-Control-Allow-Origin: *` direkt am Controller. Volles CORS-Middleware für Cross-Domain Embeds deferred auf Session 15.
29. **[Tech-Debt Session 8] Lead Enrichment Worker deferred** — BullMQ `lead-enrichment` Queue Stub funktioniert; KI-Logik (Worker) kommt in Session 14.
30. **[Tech-Debt Session 8] HTML-Attribut-Injection im Embed-Snippet** — `form.name` wird unescaped in `title="${form.name}"` interpoliert (`forms.service.ts:98`). Fix: vor Interpolation escapen (`replace(/"/g, '&quot;')`). Geplant Session 15.
31. **[Tech-Debt Session 8] Fehlende `@Roles()` auf LeadsController-Mutationen** — `convert`, `reEnqueue` und `delete` in `leads.controller.ts` haben kein Rollen-Guard; jeder Auth-User kann Leads mutieren (vs. ADMIN/MANAGER bei FormsController). Geplant Session 15.
32. **[Tech-Debt Session 9] Web functions-Schwellwert auf 64% gesenkt** — V8 zählt JSX-Inline-Arrows als Functions; DealProductsTab Mutation-Handler inflationieren Denominator. Threshold war 65%, jetzt 64%. Review in Session 16a.
33. **[Tech-Debt Session 10] `projects/dto/**` aus API-Coverage ausgeschlossen** — class-validator DTOs ohne testbares Verhalten, analog zu `auth/dto`. Geplant Session 16a.
34. **[Tech-Debt Session 10] `testTimeout: 30_000` in vitest.config.ts** — bcrypt cost-12 unter paralleler Turbo-Last übersteigt 5000ms Default. Verhindert flaky timeouts; kein funktionales Problem.
35. **[Tech-Debt Session 10] ProjectKanban ohne order-Feld** — DnD ändert nur Status, keine Reihenfolge innerhalb einer Spalte. Project-Model hat kein `order`-Feld. Erweiterung in Session 16a möglich.
36. **[Tech-Debt Session 10] Global Tasks `/tasks` Client-seitige Datumsfilterung** — Filter 'today'/'week' nutzen Browser-Timezone via `isSameDay()`/`isThisWeek()`. Serverseitige Filterung für konsistentes Verhalten geplant Session 16a.
37. **[Tech-Debt Session 11] `email-sync.service.ts` aus Unit-Coverage ausgeschlossen** — External-API-Wrapper (googleapis + Microsoft Graph). Integration-Tests in Session 16a.
38. **[Tech-Debt Session 11] Keine Rate-Limitierung auf Webhook-Endpoints** — `/api/v1/webhooks/gmail` + `/outlook` sind `@Public`; kein IP-Rate-Limit. Session 15.
39. **[Tech-Debt Session 11] `getOutlookAccessToken` nutzt `obtained_at`-Heuristik** — Microsoft gibt `ext_expires_in` zurück, wir rechnen selbst. Clock-Drift-Risiko minimal. Session 15.
40. **[Done Session 11] Tech-Debt #10 (NavRail Inbox-Badge)** — `DashboardLayout` ruft `getUnreadCount` mit 60 s Refetch via React Query. Badge live verdrahtet.

---

## Aktuelle Session-Notizen
Aktive Session: Session 12 (M5 E-Mail-Campaigns).

**Voraussetzungen erfüllt (aus Session 11):**
- EmailModule vollständig: 14 Endpoints, Gmail + Outlook OAuth2, Watch/Poll, GPT-4o Summary
- Email.userId FK-Constraint migriert (Tech-Debt #5 erledigt)
- Inbox-UI mit 2-Panel-Layout, TipTap-Compose, NavRail-Badge
- Tech-Debts #37-40 dokumentiert

**Session 11 abgeschlossen:** M6 E-Mail-Sync vollständig. 4/4 ACs. PR offen.
→ Details: [docs/20-sessions/session-11-summary.md](docs/20-sessions/session-11-summary.md)

**Tests (kumulativ):** ~386 API-Tests (~80%+ Stmt), ~469 Web-Tests (~80%+ Stmt). Gesamt: ~855 Tests.

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
| `GMAIL_SYNC_CALLBACK_URL` | Redirect-URL für Gmail OAuth E-Mail-Sync Callback | 11 |
| `EMAIL_OAUTH_STATE_SECRET` | HMAC-Secret für OAuth CSRF State-Tokens (≥32 chars; Fallback: JWT_SECRET) | 11 |
| `GCP_PUBSUB_PROJECT` | Google Cloud Projekt-ID für Gmail Watch (leer = Watch deaktiviert) | 11 |
| `GCP_PUBSUB_TOPIC` | PubSub Topic Name (default: `nextgen-gmail-push`) | 11 |
| `GCP_PUBSUB_SA_EMAIL` | Service-Account-E-Mail für PubSub JWT-Verifikation (leer = dev-Modus) | 11 |
| `OUTLOOK_SYNC_CALLBACK_URL` | Redirect-URL für Outlook OAuth E-Mail-Sync Callback | 11 |
| `OPENAI_API_KEY` | OpenAI API Key für GPT-4o Thread-Summary | 11 |

---

## Schnell-Links
- [Alle Module](docs/10-modules/) | [Sessions](docs/20-sessions/) | [Reviews](docs/30-reviews/)
- [Entscheidungen (ADRs)](docs/40-decisions/) | [Runbooks](docs/50-runbooks/)
- [KI-Prompts](docs/60-prompts/) | [Doc-Index](docs/99-index.md)
- [Quality-Gate](scripts/quality-gate.sh) | [Glossar](docs/00-overview/glossary.md)
