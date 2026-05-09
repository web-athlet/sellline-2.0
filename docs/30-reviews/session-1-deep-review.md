---
title: "Deep Review Session 1 — DB-Schema + Prisma + Seed"
session: 1
type: deep
status: issues
date: 2026-05-09
blockers: 4
summary: "Schema grundsaetzlich solide; 4 BLOCKER initial — davon 2 echt (S1 bcrypt-cost, S4 Prod-Seed-Guard) und 2 False Positives (S2 tokenHash bereits implementiert, S3 revokedAt bereits implementiert). Echte Fixes in fix/session-1-security."
---

# Deep Review — Session 1

**Status:** FINDINGS (17 — davon 4 BLOCKER initial)

> **Wichtig — Verifikations-Hinweis:** Bei der Implementierung der BLOCKER-Fixes wurde festgestellt, dass S2 (tokenHash) und S3 (revokedAt) bereits im Schema implementiert waren — die Findings sind False Positives, hervorgegangen aus einer Misinterpretation der Session-Summary. Korrekt verbleibend: **S1 (bcrypt 10→12)**, **S4 (NODE_ENV-Prod-Seed-Guard)** und ein partial-FP **S3** (`revokedAt` war da, aber `replacedByToken` fehlte fuer vollstaendige Token-Rotation-Chain — wurde ergaenzt).

## Scope

`git diff main..feature/session-1-db-schema` — 12 Dateien, ~1700 hinzugefuegte Zeilen.

| Datei | Zeilen (neu) |
|-------|-------------|
| `packages/db/prisma/schema.prisma` | 544 |
| `packages/db/prisma/seed.ts` | 363 |
| `packages/db/prisma/migrations/20260509153907_init/migration.sql` | 625 |
| `packages/db/src/index.ts` | ~13 |
| `packages/db/src/index.test.ts` | ~18 |
| `packages/db/vitest.config.ts` | ~20 |
| `packages/db/package.json` | ~28 |
| `packages/db/tsconfig.json` | ~12 |
| `package.json` (root) | ~3 |
| `CLAUDE.md`, `docs/20-sessions/session-01-summary.md`, `docs/99-index.md` | Docs |

---

## Security (OWASP Top 10)

| # | Kategorie | Severity | Datei:Zeile | Problem | Vorschlag |
|---|-----------|----------|-------------|---------|-----------|
| S1 | A07 — Authentication (bcrypt cost) | **BLOCKER** | `seed.ts:73` | bcrypt-Rounds = **10**. OWASP empfiehlt 2026 mindestens 12, idealerweise 13. Demo-User-Hashes landen via Seed auch in CI-Datenbanken. | Rounds auf 12 erhoehen: `await bcrypt.hash(pw, 12)`. Laufzeit ~400ms statt ~100ms — vertretbar. |
| S2 | A07 — Authentication (Token Storage) | **BLOCKER (False Positive)** | `schema.prisma:RefreshToken` / `PasswordReset` | _(Bei Verifikation: Schema verwendet bereits `tokenHash String` statt `token String` fuer beide Modelle — kein Klartext-Token in DB.)_ | Keine Aktion erforderlich. |
| S3 | A07 — Authentication (RefreshToken Revocation) | **BLOCKER (Partial FP)** | `schema.prisma:RefreshToken` | _`revokedAt` war bereits vorhanden._ Was fehlte: `replacedByToken` fuer Token-Familie-Rotation (OWASP empfohlen). | `replacedByToken String?` ergaenzt — Migration `20260509170000_add_refresh_token_replaced_by`. |
| S4 | A04 — Insecure Design (Prod-Seed-Guard) | **BLOCKER** | `seed.ts:1-363` | Kein `NODE_ENV`-Guard am Seed-Einstiegspunkt. `prisma db seed` in einer Production-Datenbank wuerde echte Daten mit Demo-Admin-Accounts ueberschreiben/vermischen. | Guard ergaenzt: `if (process.env.NODE_ENV === 'production' && SEED_ALLOW_PROD !== '1') { exit(1) }`. |
| S5 | A02 — Cryptographic Failures (HMAC-Tracking) | MAJOR | `schema.prisma:CampaignContact` | `trackingToken String @unique` — kein expliziter Hinweis, ob HMAC oder UUID. CLAUDE.md verbietet reine UUIDs fuer Tracking-Tokens. | In Session 12 (Campaigns): HMAC-SHA-256-Tokens, Feldlaenge `@db.Char(64)` (hex) oder `@db.Char(43)` (base64url). |
| S6 | A07 — Authentication (PasswordReset usedAt) | MAJOR (False Positive) | `schema.prisma:PasswordReset` | _Bei Verifikation: `usedAt DateTime?` ist bereits im Schema vorhanden._ | Keine Aktion. |
| S7 | A05 — Misconfig (email case-sensitivity) | MINOR | `schema.prisma:User` | `User.email @unique` ist case-sensitive in PG. `User@example.com` und `user@example.com` waeren verschiedene Accounts. | Funktional-Index `lower(email)` in spaeterer Migration; Email vor Speicherung in lowercase normalisieren. |

---

## DSGVO

| # | Severity | Bereich | Problem | Vorschlag |
|---|----------|---------|---------|-----------|
| D1 | MAJOR | Soft-Delete-Vollstaendigkeit | `AIInsight` hat kein `deletedAt`-Feld — bei Right-to-Erasure-Requests koennen KI-Insights mit personenbezogenen Enrichment-Daten nicht soft-deleted werden. | Session 14: `AIInsight.deletedAt DateTime?` + `@@index([deletedAt])`. |
| D2 | MAJOR | Retention-Policy | Kein `retainUntil DateTime?` oder `purgeAfter DateTime?` Feld. DSGVO Art. 5(1)(e) Speicherbegrenzung nicht im Schema abbildbar. | Session 15: Mindestens auf `AuditLog`, `Person`, `Organization`. |
| D3 | MAJOR | Art. 7 Einwilligung | `Person.optIn`/`optInSource`/`optInAt` vorhanden — aber kein `optOutAt DateTime?` Feld. Bei Widerruf der Einwilligung kann nicht dokumentiert werden, *wann* der Opt-out erfolgte. | Session 12: `Person.optOutAt DateTime?`. |
| D4 | MAJOR | Right to be Forgotten (Cascade) | Kein expliziter `onDelete: Cascade` auf `DealProduct`, `CampaignContact`, `Task`. Soft-deleted Parent hinterlaesst verwaiste Children. | Session 5/12: Cascade-Strategien. |
| D5 | MINOR | PII in Seed-Logs | `seed.ts` loggt Counts via `console.log('✅ Seed complete:', counts)` — Counts sind OK, keine PII. Trotzdem zukuenftig vorsichtig: keine Email/Namen/IDs in Logs. | Defensive Pattern beibehalten. |
| D6 | MINOR | AuditLog Art. 30 ROPA | `AuditLog` hat `@@index([userId, createdAt(sort: Desc)])` — Composite fuer `(entityType, createdAt)` fuer ROPA-Auswertungen fehlt. | Session 15: `@@index([tableName, createdAt])` ergaenzen. |

---

## Performance

| # | Severity | Datei:Bereich | Problem | Vorschlag |
|---|----------|---------------|---------|-----------|
| P1 | MAJOR | `schema.prisma:Deal` | `@@index([orgId])` ist da, aber kein Composite mit `deletedAt`. Deal-Liste nach Organisation filtert immer mit `deletedAt: null`. | Session 5: `@@index([orgId, deletedAt])`. |
| P2 | MAJOR | `schema.prisma:Activity` | `@@index([assigneeId, dueDate, done])` ist da. Aber kein dedizierter Index nur auf `dueDate` fuer Faelligkeits-Dashboard ueber alle Assignees. | Session 7: `@@index([dueDate, deletedAt])`. |
| P3 | MAJOR | `schema.prisma:Email` | Email hat `@@index([threadId, userId])`, `[dealId]`, `[userId, sentAt(sort: Desc)]`, `[deletedAt]`. Aber kein Index auf `personId` oder `organizationId` (falls Felder existieren — Email-Modell hat aktuell keinen `personId`). Akzeptabel fuer initial; Re-evaluierung bei Session 11. | Session 11: Re-evaluieren wenn E-Mail-Sync-Module Person-FK hinzufuegt. |
| P4 | MAJOR | `schema.prisma:AuditLog` | Composite `(tableName, recordId, createdAt)` fuer Compliance-Queries fehlt. | Session 15: `@@index([tableName, recordId, createdAt])`. |
| P5 | MINOR | `schema.prisma:CampaignContact` | `@@unique([campaignId, personId])` und `@@index([trackingToken])` vorhanden. Aber keine separaten Indexes auf `personId` allein (alle Campaigns einer Person). | Session 12: `@@index([personId])`. |
| P6 | MAJOR | `schema.prisma:Organization.enrichmentEmbedding` | `vector(1536)`-Feld vorhanden, aber **kein HNSW- oder IVFFlat-Index**. Similarity-Search ohne Vektorindex ist O(n) Full-Scan. | Session 14: `CREATE INDEX ON organizations USING hnsw (enrichment_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);` als raw-SQL-Migration. |
| P7 | MINOR | `schema.prisma:Lead` | `@@index([enrichmentStatus, createdAt])` vorhanden. Kein Index auf `[formId, createdAt]` fuer Form-Analytics. | Session 8: ergaenzen. |

---

## Architektur

| # | Severity | Bereich | Problem | Vorschlag |
|---|----------|---------|---------|-----------|
| A1 | MAJOR | `src/index.ts` — Singleton-Disconnect | `getPrisma()` gibt globalen Singleton zurueck, ohne `process.on('beforeExit')` / `SIGTERM`-Hook fuer `$disconnect()`. Bei abruptem Prozessende koennen PG-Verbindungen offen bleiben. | Session 2: NestJS `PrismaService.onModuleDestroy` ruft expliziten `disconnectPrisma()`-Export auf. |
| A2 | MAJOR | Bare-FKs (`Email.userId`, `Task.assigneeId`) | Korrekt als Tech-Debt in CLAUDE.md dokumentiert. **Kein DB-FK-Constraint** — geloeschter User hinterlaesst verwaiste Email-Eintraege ohne Constraint-Error. Gefaehrlich in DSGVO-Kontext. | Session 11 / 10: `@relation` wie bereits geplant. Kurzfristig: CHECK-Constraint via raw Migration. |
| A3 | MINOR | `seed.ts` — UUIDv5-Namespace | `NS = '7e1b2c3d-...'` ist projekt-spezifischer Namespace (gut). UUIDv5 ueber `id('user-admin')`-Keys statt Email — Demo-User-IDs aendern sich nicht bei Email-Wechsel (gut). | Keine Aktion. |
| A4 | MINOR | `vitest.config.ts` — Coverage-Threshold | Coverage-Threshold gesetzt (80% laut Session-Summary). Bei nur 13 LOC effektiv erreicht. | Keine Aktion. |
| A5 | MINOR | Migration-Workflow-Drift | `migrate dev` lief non-interaktiv via `migrate diff + deploy`. Drift-Detection (`prisma migrate status`) nicht im CI. | Session 16b: `prisma migrate status` als CI-Step. |

---

## Test-Coverage & Error-Handling

| # | Severity | Datei:Bereich | Problem | Vorschlag |
|---|----------|---------------|---------|-----------|
| T1 | MINOR | `index.test.ts` | 3 Smoke-Specs (Singleton, Re-Export, Version) — angemessen fuer 13 LOC im DB-Package. | Keine Aktion fuer Session 1. |
| T2 | MAJOR | `seed.ts` — Fehlerbehandlung | `.catch(err => process.exit(1)).finally($disconnect)` — `process.exit(1)` terminiert vor `.finally()` synchron. PG-Verbindungen koennen bei Seed-Fehlern haengen. | Session 16a: `try/finally` umstrukturieren, `$disconnect` vor `process.exit`. |
| T3 | MAJOR | Seed-Idempotenz-Test fehlt | Kein automatisierter Test fuer Re-Run-Idempotenz. Manuelle Verifikation ueber 3 Re-Runs. | Session 16a: Integrations-Test (TestContainers): seed → counts → seed → counts gleich. |
| T4 | MINOR | `seed.ts` — Faker-Locale | `fakerDE` korrekt importiert. `faker.seed(42)` fuer Determinismus gesetzt — gut. | Keine Aktion. |

---

## Quality-Gate

| Check | Ergebnis | Detail |
|-------|----------|--------|
| TypeScript (typecheck) | PASS | Keine Fehler |
| ESLint (lint) | PASS | Keine Fehler |
| Unit-Tests | PASS | 3 Tests, 3 passed |
| Coverage-Threshold | GESETZT | 80% (session summary) |
| npm audit (critical) | PASS | 0 critical |
| npm audit (high) | FAIL (Known Tech-Debt) | Next.js 14.2.x CVE GHSA-q4gf-8mx6-v5v3 — geplant Session 15 |
| Prisma Migrate Status | NICHT GEPRUEFT | CI-Step fuer Drift-Detection geplant Session 16b |

---

## Schema-Inventar

- **19 Models:** User, RefreshToken, PasswordReset, Pipeline, Stage, Deal, Organization, Person, Activity, Email, Product, DealProduct, Lead, Form, Campaign, CampaignContact, Project, Task, ProjectTemplate, AIInsight, AuditLog (plus implizite M2M-Tabelle `_DealParticipants`).
- **7 Enums:** Role, ActivityType, Priority, DiscountType, EnrichmentStatus, CampaignStatus, ProjectStatus.
- **Soft-Delete-Indexe:** 13 `@@index([deletedAt])` Eintraege.
- **Composite Uniques:** `Stage(pipelineId, order)`, `CampaignContact(campaignId, personId)`.
- **Tracking-Token-Felder:** `CampaignContact.trackingToken String @unique` — UUID-Format, **nicht HMAC-signiert** (Finding S5, geplant Session 12).
- **pgvector:** `Organization.enrichmentEmbedding vector(1536)` — **KEIN HNSW/IVFFlat-Index** (Finding P6, geplant Session 14).
- **Auth-Token-Hashing:** `RefreshToken.tokenHash`, `PasswordReset.tokenHash` — **kein Klartext** ✅ (S2 widerlegt).
- **Token-Rotation:** `RefreshToken.revokedAt` ✅ und `replacedByToken String?` (in `fix/session-1-security` ergaenzt).
- **Bare-FKs (kein @relation):** `Email.userId`, `Task.assigneeId` — dokumentiert als Tech-Debt.

---

## Empfehlung Merge

**APPROVE-WITH-CONDITIONS — nach Anwendung der Fixes in `fix/session-1-security`**

Schema strukturell solide: Soft-Delete-Pattern konsistent, DSGVO-Basisfelder vorhanden, AuditLog vorhanden, pgvector-Extension vorbereitet, Token-Hashing bereits implementiert (S2 widerlegt), Seed idempotent via UUIDv5+upsert.

Echte BLOCKER (S1, S4, S3-partial) werden in `fix/session-1-security` behoben:
1. ✅ S1: bcrypt cost 10 → 12 in `seed.ts`
2. ✅ S3-partial: `replacedByToken String?` auf `RefreshToken` (Migration `20260509170000_add_refresh_token_replaced_by`)
3. ✅ S4: NODE_ENV-Prod-Seed-Guard mit `SEED_ALLOW_PROD=1`-Override

False Positives (kein Aufwand):
- ❌ S2: `tokenHash` war bereits implementiert
- ❌ S6: `usedAt` war bereits implementiert

MAJOR-Findings als Tech-Debt in nachfolgende Sessions delegiert (siehe CLAUDE.md Offene Punkte #9).

---

## Mandatory before Session N

### Vor Session 2 (Authentication)
- ✅ S1, S3-partial, S4 bereits in `fix/session-1-security` behoben
- A1 PrismaService Singleton-Disconnect-Lifecycle implementieren

### Vor Session 5 (Deals)
- P1 `@@index([orgId, deletedAt])` auf Deal
- D4 Cascade-Strategie fuer DealProduct

### Vor Session 7 (Activities)
- P2 `@@index([dueDate, deletedAt])` auf Activity

### Vor Session 11 (E-Mail-Sync)
- A2 `Email.userId` als echte `@relation`
- P3 Re-Evaluierung Email-Indexe

### Vor Session 12 (Campaigns)
- S5 HMAC-Tracking-Tokens auf CampaignContact
- D3 `Person.optOutAt`
- D4 Cascade fuer CampaignContact
- P5 `@@index([personId])` auf CampaignContact

### Vor Session 14 (KI-Agenten)
- P6 HNSW-Index fuer `Organization.enrichmentEmbedding`
- D1 `AIInsight.deletedAt` + Index

### Vor Session 15 (Security & DSGVO)
- S7 `lower(email)`-Funktionalindex
- D2 Retention-Felder
- D6 AuditLog `[tableName, createdAt]`
- P4 AuditLog Composite-Index

### Vor Session 16a (Testing)
- T2 Seed-Disconnect-Order-Fix
- T3 Seed-Idempotenz-Property-Test (TestContainers)

### Vor Session 16b (CI/CD)
- A5 `prisma migrate status` Drift-Check als CI-Step
