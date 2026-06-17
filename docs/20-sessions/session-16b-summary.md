---
title: 'Session 16b Summary — PWA & CI/CD'
tags: [session, summary, pwa, ci-cd, docker, kubernetes, deploy, observability, backup, health-check]
status: completed
session: 16b
last_updated: 2026-06-17
summary: 'Production-Launch-Finalisierung: PWA (@ducanh2912/next-pwa, Manifest, 8 Icons, expliziter SW-Update-Prompt statt Silent-Update), Health-Liveness/Readiness-Split (503 bei DB-Fehler), RedisService-Shutdown-Härtung (TD-S16a-02 gelöst), Multi-Stage-Dockerfiles (web+api, Monorepo-korrekt), deploy.yml (GHCR → kubectl, prod-Approval), vollständige k8s-Manifeste (EU-only, RollingUpdate maxUnavailable 0, HPA/PDB/NetworkPolicy), Observability-Config (ServiceMonitor/Alerts/Grafana) + pg_dump-Backup-CronJob + Disaster-Recovery-Runbook. Quality-Gate grün; Web-Build erzeugt SW + standalone real. Neue TD-S16b-01/02. Schema unverändert.'
---

# Session 16b — PWA & CI/CD

> Scope: **Production-Launch-Finalisierung.** Code/IaC/Runbooks vollständig & buildbar; reine Laufzeit-ACs (Lighthouse-Score, iOS/Android-Install, Live-k8s-Rollout, Grafana/PagerDuty, pg_dump-Restore-Test) brauchen eine echte Umgebung und sind ehrlich als „in geeigneter Umgebung nachzuholen" markiert — analog zum E2E/k6-Scaffold aus Session 16a.

## TLDR (5 Punkte)

1. **PWA vollständig:** `@ducanh2912/next-pwa` (gewartete App-Router-Variante statt des toten `next-pwa`) in `apps/web/next.config.mjs` mit `runtimeCaching` (NetworkFirst für `/api/(contacts|deals|leads)`, CacheFirst für Bilder + `_next/static`, `skipWaiting:false`). `public/manifest.json` + Layout-`metadata`/`viewport`. `scripts/generate-icons.js` (sharp; brandender Platzhalter-Fallback) → 8 Icon-Größen + apple-touch + shortcut-deal committed. **Block 2:** `PWAUpdatePrompt.tsx` zeigt einen Toast bei wartender neuer Version und postet `SKIP_WAITING` erst auf Klick → **kein Silent-Update** (schützt ungespeicherte Formulardaten).

2. **Schema-Änderungen: keine.** Keine Migration. Health-Check-Härtung: Liveness `GET /api/health` (kein DB-Zugriff) vs. Readiness `GET /api/health/ready` (Prisma `SELECT 1` + Redis-`ping`) → **503 nur bei DB-Ausfall**, Redis-down = degraded-but-ready.

3. **Neue Env-Variablen: keine** (App-seitig). Deploy/Backup-Secrets (`KUBE_CONFIG`, GHCR-Token, `nextgen-backup`) sind Infra-Secrets außerhalb der App-`.env`. **Neue Deps:** `@ducanh2912/next-pwa` (apps/web), `sharp` (Root-devDep für das Icon-Script).

4. **Limitierungen / bewusst deferred:** (a) **TD-S16b-01** — `@nextgen/db|types|utils` exportieren TS-Source (`main: ./src/index.ts`); swc/Next transpilen das, aber ein nacktes `node dist/main.js` (API-Prod-Image) kann TS nicht `require`. API-Dockerfile liefert die Package-Source als Stopgap; saubere Lösung = Precompile (build-Scripts + dual exports). Web-Image ist sauber (Next inlined Workspace-Source). (b) **TD-S16b-02** — `/api/metrics` (prom-client) **nicht** implementiert (vermeidet Coverage-Gate-Drag); pino-Logs + nginx/kube-Metriken sind live, ServiceMonitor/Alerts sind vorbereitet. (c) Laufzeit-ACs (Lighthouse, Mobile-Install, Live-Rollout, Grafana, Restore-Test) nicht in dieser Umgebung verifizierbar.

5. **Nächste Session braucht:** `/api/metrics`-Endpoint (TD-S16b-02) + Workspace-Precompile (TD-S16b-01) vor echtem API-Prod-Image; reale Umgebung für Lighthouse/Mobile/Rollout/Restore-Test; E2E-`data-testid`-Hooks + deterministischer Seed (offen aus TD-S16a-01).

## Frontend / PWA (`apps/web`)

| Datei | Rolle |
|-------|-------|
| `next.config.mjs` | `withPWAInit` (@ducanh2912) + `output: 'standalone'` + `experimental.outputFileTracingRoot` (Monorepo-Root, damit Standalone Workspace-Deps traced). |
| `public/manifest.json` | Web-App-Manifest (name/short_name/theme/8 Icons/maskable/shortcuts). |
| `public/icons/*` | 8 Größen (72–512) + `apple-touch-icon.png` + `shortcut-deal.png` (sharp-generierter Platzhalter; vor Launch durch echtes Logo ersetzen). |
| `app/layout.tsx` | `metadata.manifest`/`appleWebApp`/`icons` + `viewport.themeColor`. |
| `components/pwa/PWAUpdatePrompt.tsx` (+`.test.tsx`) | Expliziter SW-Update-Toast; gemountet in `DashboardLayout`. 5 Tests (jsdom, navigator.serviceWorker gemockt). |
| `.gitignore` (neu) | Ignoriert generierte `sw.js`/`workbox-*`/`swe-worker-*`. |

## Backend (`apps/api`)

| Datei | Änderung |
|-------|----------|
| `src/health.controller.ts` (+spec) | Liveness `GET /health` + Readiness `GET /health/ready` (DI: Prisma+Redis; 503 via `ServiceUnavailableException` bei DB-Fehler). |
| `src/redis/redis.service.ts` (+spec neu) | **TD-S16a-02 gelöst:** `onModuleDestroy` guarded auf `client.status` (quit nur bei ready/connecting, sonst `disconnect()`); neue `ping()`-Methode für Readiness. |

## Infrastruktur (IaC)

| Datei | Rolle |
|-------|-------|
| `apps/web/Dockerfile` | Multi-Stage, Monorepo-korrekt, Next-Standalone (`server.js` unter `apps/web/.next/standalone/apps/web/`). Voll-Install statt spec-`--prod` (next/tailwind nötig). |
| `apps/api/Dockerfile` | Multi-Stage, `prisma generate`, openssl (Alpine). Workspace-TS-Source-Caveat (TD-S16b-01) dokumentiert. |
| `.dockerignore` | node_modules/.next/dist/docs/tests/SW-Artefakte. |
| `.github/workflows/deploy.yml` | `workflow_run` (CI grün auf `main`) → GHCR build+push (web+api, gha-Cache) → `kubectl set image`/`rollout status` mit Auto-`rollout undo`. `environment: production` = Approval-Gate. **Bestehende `ci.yml`/`e2e.yml` unverändert** (16a-Struktur besser als spec-Monolith). |
| `k8s/{namespace,web-deployment,api-deployment,ingress,hpa,pdb,networkpolicy,backup-cronjob}.yaml` | EU-`nodeSelector`, RollingUpdate `maxUnavailable:0`/`maxSurge:1`, Probes, HPA (CPU 70 %→3–10), PDB `minAvailable:2`, Default-Deny-NetworkPolicy, nightly `pg_dump`→S3-EU (30 Tage). |
| `k8s/secrets.example.yaml` | Template (keine echten Werte). |
| `k8s/observability/{servicemonitor,prometheus-rules,grafana-dashboard}.*` | Scrape-Config (für `/api/metrics`, TD-S16b-02), Alerts (5xx>1 %, p95>1 s, Crashloop, Queue-Depth), Grafana-Dashboard-JSON. |
| `docs/50-runbooks/disaster-recovery.md` | RTO/RPO, Postgres-Restore, vierteljährlicher Restore-Test, MinIO-Replikation, Region-Ausfall. |

## Acceptance Criteria

| AC | Status |
|----|--------|
| Lighthouse-PWA-Score ≥ 95 | ⏸ Laufzeit (Build erzeugt SW + Manifest + Icons + maskable real) |
| App installierbar iOS + Android | ⏸ Laufzeit (Manifest/Icons/apple-meta vorhanden) |
| SW-Update-Prompt (kein Silent-Update) | ✅ `PWAUpdatePrompt` + `skipWaiting:false`, 5 Tests |
| Alle 8 Icon-Größen + maskable | ✅ generiert & committed (72–512, 192/512 maskable) |
| CI grün → Auto-Deploy `main` mit Prod-Approval | ✅ `deploy.yml` (`environment: production`) |
| K8s Rolling-Update ohne Downtime | ✅ Manifeste (`maxUnavailable:0`); ⏸ Live-Rollout |
| Alle Pods EU-Region (DSGVO) | ✅ `nodeSelector` auf allen Deployments + CronJob |
| `/api/health` 200 healthy / 503 DB-Fehler | ✅ Readiness-Endpoint + Tests |
| Prometheus-Metrics + Grafana-Dashboard | ⏸ Dashboard/Alerts/ServiceMonitor da; `/api/metrics`-Endpoint = TD-S16b-02 |
| pg_dump-Cron + Restore-Test | ✅ CronJob + Runbook; ⏸ Restore-Test (Laufzeit) |

## Tech-Debts (neu / Status)

- **[Gelöst] TD-S16a-02** — `RedisService.onModuleDestroy` status-guarded + `disconnect()`-Fallback; neue `redis.service.spec.ts`.
- **[Neu] TD-S16b-01** — Workspace-Packages exportieren TS-Source → API-Prod-Image (`node dist/main.js`) braucht Precompile (build-Scripts + dual exports). API-Dockerfile liefert Source als Stopgap.
- **[Neu] TD-S16b-02** — `/api/metrics` (prom-client) nicht implementiert (Coverage-Gate-Drag vermieden); ServiceMonitor/Alerts vorbereitet.
- **[Offen]** Laufzeit-Verifikation (Lighthouse/Mobile/Live-Rollout/Grafana/Restore-Test); TD-S16a-01 (E2E `data-testid`+Seed), TD-S16a-03 (k6-p95) weiter offen.

## Tests (kumulativ)

- **Unit:** API unverändert + **redis.service.spec.ts (6)** + **health.controller.spec.ts (6, erweitert)**; Web + **PWAUpdatePrompt.test.tsx (5)**.
- **Integration:** unverändert 4 Suites / 10 Tests (testcontainers) — grün mit neuem Health-DI + Redis-Shutdown.
- Quality-Gate **grün**. Web-Build erzeugt real `sw.js`/`workbox-*.js` + Standalone (`apps/web/.next/standalone/apps/web/server.js` — exakt der Dockerfile-COPY-Pfad).

## Nächste Session

**Session 17 (oder PR-Folge):** `/api/metrics` + Workspace-Precompile; reale Umgebung für Lighthouse/Mobile/Rollout/Restore; offene Coverage-Tech-Debts (16a) + E2E-`data-testid`/Seed.
