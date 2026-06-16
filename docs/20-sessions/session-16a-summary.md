---
title: 'Session 16a Summary — Testing & Performance (Foundation)'
tags: [session, summary, testing, integration-tests, testcontainers, fishery, factories, websocket, playwright, k6, ci]
status: completed
session: 16a
last_updated: 2026-06-16
summary: 'Runnable Test-Foundation: testcontainers-Integration-Harness (pgvector + Redis, Migrationen via migrate deploy → TD#53 für Test-Pfad gelöst), Fishery-Test-Daten-Factories für alle Haupt-Entities, deterministische WebSocket-Integration-Tests, parallele CI-Jobs (lint/typecheck/unit/integration/build) + main-only E2E-Workflow. Playwright (5 Happy-Paths × 3 Projects) und k6 (3 Load-Skripte) als Scaffold (nicht ausgeführt). Quality-Gate 10/10, Integration-Check jetzt real statt 1+1-Placeholder.'
---

# Session 16a — Testing & Performance (Foundation)

> Gewählter Scope: **„Runnable foundation first"** (Blocks 1+2+4+5+8 gebaut & verifiziert; Blocks 6+7 als Scaffold). Begründung: Unit-Coverage lag bereits bei 91.1 % API / 88.7 % Web (AC „≥ 80 %" erfüllt), daher Fokus auf die echten Lücken: Integration-Harness, Factories, WS-Determinismus, CI-Verdrahtung.

## TLDR (5 Punkte)

1. **Integration-Test-Harness mit testcontainers** (`apps/api/test/integration/`): `global-setup.ts` startet **pgvector/pgvector:pg16** + **redis:7-alpine**, wendet via `prisma migrate deploy` alle Migrationen auf den Wegwerf-Container an und reicht die Connection-Strings per Vitest `provide()`/`inject()` an die Worker. Eigene `vitest.integration.config.ts` (single-fork, `*.int-spec.ts`). **4 Suites / 10 Tests grün** in ~16 s: Deals-Create (+Owner-Default, Auth-401, Stage-Validierung), Contacts Create→List (+Validation-400), **GDPR-Export-ZIP + Per-User-429-Throttle + RBAC-403**, WebSocket `deal:created`-Zustellung + Invalid-Token-Kick.

2. **Schema-Änderungen: keine.** Stattdessen wird durch `migrate deploy` gegen den Container **TD#53 für den Test-Pfad gelöst** (die unangewendeten S14+S15-Migrationen laufen sauber durch). Der lokale Dev-`.env`-`DATABASE_URL` bleibt davon unberührt (weiterhin offen).

3. **Neue Env-Variablen: keine** (Test-Secrets `JWT_SECRET`/`ENCRYPTION_KEY` werden in `test/integration/setup.ts` statisch gesetzt). **Neue Deps:** `fishery`, `@faker-js/faker`, `testcontainers@^10` (v12 verlangt Node 22), `socket.io-client`, **`express@^4.21.2`** (war nur transitiv via platform-express; Vite konnte `express` beim Bündeln des vollen `AppModule` nicht auflösen — bewusst auf v4 gepinnt) — alle in `apps/api`. `@playwright/test` in Root-devDeps.

4. **Limitierungen / bewusst deferred (Scaffold, nicht ausgeführt):** (a) **Playwright-E2E** — 5 Happy-Paths × 3 Projects geschrieben, aber Browser nicht installiert + keine `data-testid`-Hooks/E2E-Seed → noch nicht lauffähig (CI-Job `e2e.yml` `continue-on-error: true`, nur auf `main`). (b) **k6-Load-Tests** — 3 Skripte geschrieben, aber kein k6-Binary/keine Perf-Umgebung → p95-ACs **nicht gemessen**. (c) Die zahlreichen für „Session 16a" vorgemerkten **Coverage-Tech-Debts** (DuplicateMergePanel, FormBuilder, CampaignWizard, DashboardBuilder, email-sync/serper/web-scraper Integration u. a.) wurden in diesem Foundation-Scope **nicht** angefasst und bleiben offen.

5. **Nächste Session braucht:** `data-testid`-Hooks im Web + deterministischen E2E-Seed (damit E2E PRs gaten kann); `RedisService.onModuleDestroy`-Härtung (siehe TD-S16a-02); ggf. k6-Perf-Run in einer geeigneten Umgebung; Abarbeitung der offenen Coverage-Tech-Debts.

## Backend / Test-Infrastruktur (`apps/api`)

| Datei | Rolle |
|-------|-------|
| `test/factories/*.factory.ts` | Fishery-Factories für `User`, `Organization` (+`companyFactory`-Alias), `Person`, `Deal`, `Lead`, `Activity`, `Project`, `Task`, `Campaign` — typisiert auf die Prisma-Modell-**Scalars**. |
| `test/factories/index.ts` | Barrel-Export. |
| `vitest.integration.config.ts` | Separate Integration-Config (swc, single-fork, `test/integration/**/*.int-spec.ts`, globalSetup). |
| `test/integration/global-setup.ts` | Startet pgvector + Redis (testcontainers), `prisma migrate deploy`, `provide(databaseUrl/redisUrl)`, Teardown. |
| `test/integration/setup.ts` | Per-Worker: liest Container-URLs via `inject()` in `process.env`, setzt `JWT_SECRET`/`ENCRYPTION_KEY`. |
| `test/integration/app.ts` | `createTestApp` (voller `AppModule`), `closeTestApp` (toleriert benignen Redis-quit-Fehler), `signAccessToken`, `resetDb` (TRUNCATE CASCADE), `flushRedis`, `seedBaseGraph` (Admin-User + Pipeline + Stage). |
| `test/integration/ws-client.ts` | socket.io-client-Helfer: `openSocket`, `connectTestSocket`, `waitForEvent`. |
| `test/integration/{deals,contacts,gdpr,events}.int-spec.ts` | Die 4 Integration-Suites (10 Tests). |

## E2E + Performance (Scaffold)

| Datei | Rolle |
|-------|-------|
| `playwright.config.ts` | 3 Projects (chromium/firefox/iPhone 14), `testDir: ./e2e`, optionaler `webServer`. |
| `e2e/{auth,deals,leads,campaigns,dashboard}.spec.ts` | 5 Happy-Paths gegen reale Routen. |
| `e2e/helpers.ts`, `e2e/README.md` | Login-Helfer + Run-Anleitung + bekannte Lücken. |
| `k6/{contacts-load,deals-kanban-load,ws-pulse-load}.js`, `k6/README.md` | Load-Szenarien (100 VU/5 min p95<300 ms; 50 VU/3 min p95<500 ms; 500 WS-Conns/10 min). |

## CI (`.github/workflows`)

- **`ci.yml`** neu strukturiert: parallele Jobs `lint` (+`format:check`), `typecheck`, `unit` (`test:coverage` — Thresholds in `vitest.config.ts` gaten Coverage-Drops), `integration` (testcontainers, `needs: unit`), `build` (`needs: lint+typecheck+unit`), `audit` (critical, non-blocking).
- **`e2e.yml`** neu: nur `push: [main]` + `workflow_dispatch`, installiert Playwright-Browser, `continue-on-error: true` (Scaffold bis testids/Seed stehen).
- Root-Scripts: `test:integration` → `turbo run test:integration --filter=@nextgen/api`; `test:e2e` → `playwright test`. Turbo-Task `test:integration` (cache:false).

## Acceptance Criteria

| AC | Beschreibung | Status |
|----|-------------|--------|
| Unit-Coverage ≥ 80 % | Bereits 91.1 % API / 88.7 % Web, in CI via vitest-Thresholds erzwungen | ✅ |
| Test-Data-Factories für alle Haupt-Entities | Fishery-Factories für 9 Entities (+Company-Alias) | ✅ |
| WebSocket-Tests deterministisch | `deal:created`-Zustellung + Invalid-Token-Kick, keine Flakes | ✅ |
| CI blockiert Merge bei Coverage-Drop | vitest-Thresholds im `unit`-Job | ✅ |
| Integration-Tests gegen echte Test-DB | testcontainers + 10 Tests grün | ✅ |
| Integration-Coverage ≥ 60 % | **Nicht gemessen** (Foundation-Scope; Suites exemplarisch, nicht erschöpfend) | ⏸ |
| 5 E2E-Happy-Paths × 3 Projects | **Scaffold** (Browser/testids/Seed offen) | ⏸ |
| k6 p95-Thresholds | **Scaffold, nicht ausgeführt** (kein k6-Binary/Perf-Umgebung) | ⏸ |

## Tech-Debts (neu / Status)

- **[Done für Test-Pfad] TD#53** — Migrationen S14+S15 werden via `prisma migrate deploy` auf den testcontainers-Postgres angewendet. **Dev-`.env`-`DATABASE_URL` weiterhin offen.**
- **[Neu] TD-S16a-01** E2E-Specs brauchen stabile `data-testid`-Hooks im Web + deterministischen E2E-Seed (eigene E2E-DB), bevor `e2e.yml` PRs gaten kann (`continue-on-error` bis dahin).
- **[Neu] TD-S16a-02** `RedisService.onModuleDestroy` ruft `client.quit()` auf einem lazyConnect-Client mit `enableOfflineQueue:false` → wirft „Stream isn't writeable", wenn nie verbunden. Test-seitig in `closeTestApp` umgangen; **Source-Härtung** offen.
- **[Neu] TD-S16a-03** k6-Load-Tests nicht ausgeführt — p95-ACs unbestätigt; in geeigneter Umgebung nachholen.
- **[Offen]** Vorgemerkte Coverage-Tech-Debts (#13/#23/#24/#27/#42/#48/#37/#55 u. a.) im Foundation-Scope **nicht** abgearbeitet.

## Tests (kumulativ)

- **Unit:** unverändert 596 API / 537 Web / Utils — Coverage Lines API 91.1 % / Web 88.7 % / Utils 100 %.
- **Integration (neu):** 4 Suites / 10 Tests (testcontainers).
- Quality-Gate **10/10 PASS** — der „Integration"-Check ist jetzt real (vorher `1+1`-Placeholder).

## Nächste Session

**Session 16b — PWA & CI/CD**: aufbauend auf der CI-Struktur dieser Session; zusätzlich offene Test-Tech-Debts (E2E-testids/Seed, RedisService-Härtung, k6-Perf-Run).
