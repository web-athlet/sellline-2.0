---
title: "Session 1 — DB-Schema (Prisma) + Idempotenter Seed"
tags: [session, session-1, db, prisma, schema, seed, pgvector]
status: completed
date: 2026-05-09
duration: ~halber Tag
model: claude-opus-4-7
thinking: ultrathink
review: done-with-fix
last_updated: 2026-05-09
summary: "Vollstaendiges Prisma-5-Schema (19 Models + 7 Enums + pgvector(1536)) in @nextgen/db plus idempotenter Seed (3 User, 1 Pipeline + 6 Stages, 10 Orgs, 20 Persons, 30 Deals, 50 Activities, 5 Products, 3 Projects + 15 Tasks, 1 Template). Initial-Migration deployed, Quality-Gate 11/11 PASS."
---

# Session 1 — DB-Schema (Prisma) + Idempotenter Seed

## TLDR (5 Zeilen — Agents lesen NUR diese 5 Punkte)

1. **Gebaut:** Vollstaendiges Prisma-Schema mit 19 Models + 7 Enums + pgvector-Extension `vector(1536)`; idempotenter Seed via UUIDv5 + upsert; Initial-Migration `20260509153907_init` deployed.
2. **Schema:** ALLE 19 Models neu (vorher nur Skeleton). Drei forced inverse-relations gegenueber Spec hinzugefuegt: `Deal.org<->Organization.deals`, `Organization.activities`, `Person.campaignContacts`. Zwei bare-column-FKs ohne Prisma-Relation (`Email.userId`, `Task.assigneeId`) bleiben spec-treu.
3. **Env-Vars:** keine. (`DATABASE_URL` existiert seit Session 0.)
4. **Limitierungen:** `migrate dev` lief non-interaktiv via `migrate diff` + `migrate deploy` (Tool-Harness ohne TTY); SQL-Output identisch. Bare-FK-Columns auf `Email.userId` / `Task.assigneeId` bekommen ihre Inverse erst in Session 11 / 10.
5. **Naechste Session braucht:** `apps/api` muss `@nextgen/db` als `workspace:*`-Dependency aufnehmen und einen `PrismaService`-Wrapper bauen; JWT_SECRET / NEXTAUTH_SECRET / NEXTAUTH_URL in `.env.example` ergaenzen.

---

## Was wurde implementiert

### `@nextgen/db` Workspace
- `packages/db/prisma/schema.prisma` (19 Models, 7 Enums, pgvector-Extension)
- `packages/db/prisma/seed.ts` (idempotent via UUIDv5 + upsert; @faker-js/faker DE-Locale; bcryptjs cost 10)
- `packages/db/prisma/migrations/20260509153907_init/migration.sql` (625 Zeilen, generiert via `prisma migrate diff --from-empty --to-schema-datamodel`)
- `packages/db/src/index.ts`: Re-export von `@prisma/client` (alle Typen + Enums) + `getPrisma()` Lazy-Singleton + `DB_PACKAGE_VERSION = '0.1.0'`
- `packages/db/src/index.test.ts`: 3 Smoke-Specs (Version-Format, PrismaClient-Re-Export, Singleton-Identitaet)
- `packages/db/vitest.config.ts`: Standard-Vitest-Config (node-Env, src/**, 80%-Coverage-Threshold)

### Models (Domain-Gruppierung)

**Identity & Auth (3):** `User`, `RefreshToken`, `PasswordReset`
**Pipeline & Deals (3):** `Pipeline`, `Stage`, `Deal`
**Contacts (2):** `Organization`, `Person`
**Activities (1):** `Activity`
**Email (1):** `Email`
**Products (2):** `Product`, `DealProduct`
**Leads & Forms (2):** `Lead`, `Form`
**Campaigns (2):** `Campaign`, `CampaignContact`
**Projects (3):** `Project`, `Task`, `ProjectTemplate`
**AI & Audit (2):** `AIInsight`, `AuditLog`

### Enums (7)
`Role`, `ActivityType`, `Priority`, `DiscountType`, `EnrichmentStatus`, `CampaignStatus`, `ProjectStatus`

### Tooling
- Root `package.json`: `@prisma/client`, `@prisma/engines`, `prisma` zu `pnpm.onlyBuiltDependencies` hinzugefuegt (sonst kein Postinstall-Generate unter pnpm 10).
- `packages/db/package.json`: Scripts `prisma:generate`, `prisma:migrate`, `prisma:migrate:deploy`, `prisma:reset`, `prisma:studio`, `prisma:seed` — alle wrappen `dotenv -e ../../.env -- prisma <cmd>`. `prisma`-Block mit `seed: "tsx prisma/seed.ts"`.
- `packages/db/tsconfig.json`: `composite` entfernt (war ungenutzt — Konsumenten verwenden `"main": "./src/index.ts"`); `noEmit: true`; `include` jetzt `src/**` + `prisma/**` damit `tsc --noEmit` auch den Seed typecheckt.
- `.env` aus `.env.example` kopiert (war im Repo nicht vorhanden — gehoert in das Onboarding-Runbook).

### Seed-Inhalt (verifiziert ueber 3 Re-Runs)

| Entity | Count | Notes |
|--------|-------|-------|
| User | 3 | admin/manager/sales @demo.de, Passwort `Demo1234!` (bcrypt cost 10) |
| Pipeline | 1 | "Vertriebs-Pipeline", `rotThresholdDays: 7`, `isDefault: true` |
| Stage | 6 | Qualifiziert → Demo geplant → Demo abgeschlossen → Angebot abgegeben → Verhandlungen → Vertrag unterschrieben |
| Organization | 10 | Bauer GmbH, Schmidt AG, Mueller IT Solutions, Weber Industries, Fischer & Soehne, Becker Consulting, Meyer Logistik, Wagner Software, Hoffmann Maschinenbau, Schulz Pharma |
| Person | 20 | DE-Faker-Namen, je 2 pro Org, 1/3 mit `optIn: true` (Source: `web-form`) |
| Product | 5 | Starter/Pro/Enterprise/Onboarding/Premium-Support (MONTHLY/YEARLY/ONE_TIME Mix) |
| Deal | 30 | Verteilt ueber alle 6 Stages, je 5 pro Stage; Owner-Roundrobin admin/manager/sales; jedes 7. mit `rotIndicator: true`; Stage-6-Deals mit `wonAt`/`closedAt` |
| Activity | 50 | Mix `ueberfaellig (i%3==0)` / `heute (i%3==1)` / `diese Woche (i%3==2)`; je 2. mit Deal-Verknuepfung; alle 6 ActivityTypes; jedes 5. `priority: HIGH`, jedes 4. `done: true` |
| Project | 3 | Status KICKOFF / IMPLEMENTATION / REVIEW; je auf einen Deal verlinkt |
| Task | 15 | 5 Tasks pro Project, j<2 markiert `done: true` |
| ProjectTemplate | 1 | "Kundenprojekt Standard" mit 5 relativen Tasks (1/7/21/35/42 Tage) |

---

## Schema-Aenderungen

Migration: `20260509153907_init` (625 SQL-Zeilen).

Inhalt:
- `CREATE EXTENSION IF NOT EXISTS "vector"`
- 7 `CREATE TYPE`-Statements (Enums)
- 22 `CREATE TABLE`-Statements (19 Models + `_DealParticipants`-Implicit-M2M-Tabelle + Prisma-internes `_prisma_migrations`)
- Composite-Unique-Constraints (`Stage(pipelineId,order)`, `CampaignContact(campaignId,personId)`)
- Singular-Unique (`User.email`, `Organization.domain`, `Product.code`, `Email.gmailMessageId`, `Email.outlookMessageId`, `Lead.convertedDealId`, `CampaignContact.trackingToken`)
- Soft-Delete-Indexe `@@index([deletedAt])` auf 13 User-Daten-Tabellen
- Composite-Indexe per Spec auf Deal / Activity / Email / CampaignContact / AuditLog

### Forced Inverse-Relations (Spec war hier unvollstaendig)
1. `Deal.orgId String?` + `Deal.org Organization? @relation("OrgDeals", fields: [orgId], references: [id])` — weil Organization `deals Deal[] @relation("OrgDeals")` deklariert.
2. `Organization.activities Activity[]` — weil Activity `org Organization?` deklariert.
3. `Person.campaignContacts CampaignContact[]` — weil CampaignContact `person Person` deklariert.

### Bare-Column-FKs (spec-treu, kein DB-Constraint)
- `Email.userId String` (Inverse kommt mit Session 11 / E-Mail-Sync-Modul)
- `Task.assigneeId String?` (Inverse kommt sobald Project-Modul den User-Side wired)

## Neue Env-Variablen

Keine. (`DATABASE_URL` aus Session 0 wird wiederverwendet.)

## Test-Coverage

| Typ | Vorher | Nachher |
|-----|--------|---------|
| Unit (api) | 100% | 100% (unveraendert) |
| Unit (web) | 100% | 100% (unveraendert) |
| Unit (utils) | 100% | 100% (unveraendert) |
| Unit (db) | — | 3 Smoke-Specs (Singleton, Re-Export, Version) |
| Integration | smoke-only | smoke-only (unveraendert) |

## Bekannte Limitierungen

1. **`Email.userId` / `Task.assigneeId` ohne Prisma-Relation** — bare String-Spalten ohne FK-Constraint auf DB-Ebene. Spec-treu; tightening in Session 11 (E-Mail) bzw. Session 10 (Project-User-Side). Kein BLOCKER.
2. **Migration via `diff + deploy` statt `migrate dev`** — Tool-Harness hat keinen TTY, Prisma `migrate dev` verlangt TTY auch mit `--create-only`. Workaround: `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > migration.sql` + `prisma migrate deploy`. Output identisch. Lokale Entwickler nutzen weiter `pnpm --filter @nextgen/db prisma:migrate` interaktiv.
3. **Doppelte pgvector-Extension-Erstellung** — `docker/postgres/init-pgvector.sql` und Prisma's `extensions = [pgvector]` erstellen beide `CREATE EXTENSION vector`. Beide idempotent (`IF NOT EXISTS`). Cleanup optional in spaeterer Aufraum-Session.
4. **Faker-Werte teilweise nicht-deterministisch** — `faker.commerce.productName()` etc. ohne Pre-Seed-Reset bei jedem Call neu. Idempotenz ist trotzdem garantiert (Row Counts stabil ueber 3 Re-Runs), weil `update: {}` keine Faker-Werte aktualisiert. Vollstaendige deterministische Werte sind nicht erforderlich.
5. **`.env` muss vor erstem Migrate-Run kopiert werden** — `cp .env.example .env`. Sollte ins Onboarding-Runbook (`docs/50-runbooks/local-dev-setup.md`).

## ACs-Status (11/11)

- [x] AC-1: `prisma migrate dev` laeuft ohne Fehler — angewendet via non-interaktive `diff + deploy`-Variante (Limitierung 2).
- [x] AC-2: `prisma db seed` ist idempotent — verifiziert ueber 3 Re-Runs, identische Row Counts.
- [x] AC-3: `ghostingSnoozedUntil` in `Deal`.
- [x] AC-4: `gmailHistoryId` + `gmailWatchExpiresAt` in `User`.
- [x] AC-5: `passwordChangedAt` in `User`.
- [x] AC-6: `optIn` + `optInSource` + `optInAt` in `Person`.
- [x] AC-7: `trackingToken @unique` in `CampaignContact` (zusaetzlich `@@unique([campaignId, personId])`).
- [x] AC-8: `PasswordReset`-Model.
- [x] AC-9: pgvector-Extension in `schema.prisma` (`extensions = [pgvector(map: "vector")]`) — installiert: `vector 0.8.2`.
- [x] AC-10: Soft-Delete-Indexe (`@@index([deletedAt])`) auf allen 13 User-Daten-Tabellen.
- [x] AC-11: Seed-Daten in DB sichtbar — verifiziert via SQL: `users=3, pipelines=1, stages=6, orgs=10, persons=20, deals=30, activities=50, products=5, projects=3, tasks=15, templates=1`.

## Review

Datei: `docs/30-reviews/session-1-deep-review.md` (Tier-3 Deep-Review, durchgefuehrt 2026-05-09 mit Opus 4.7)

Ergebnis: 4 BLOCKER initial — davon 2 echte (S1 bcrypt 10→12; S4 NODE_ENV-Prod-Seed-Guard) und 2 False Positives (S2 `tokenHash` war bereits implementiert; S3 `revokedAt` war bereits da, nur `replacedByToken` fehlte). Echte Fixes in Branch `fix/session-1-security` plus zusaetzliche Migration `20260509170000_add_refresh_token_replaced_by` (`replacedByToken`-Feld auf `RefreshToken` fuer Token-Rotation-Chain). 13 MAJOR/MINOR-Findings als Tech-Debt offen, geplant in Folge-Sessions (siehe CLAUDE.md Offene Punkte #9).
