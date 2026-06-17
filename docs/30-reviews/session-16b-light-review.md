# Session 16b — Tier-2 Light Review (PWA & CI/CD)

> Reviewer: Tier-2 (isolierter Context via `/review-light`) · Datum: 2026-06-17
> Scope: `git diff main..HEAD` — 47 Dateien (Code-relevant: ~14; Rest k8s-YAML, Icons, Lockfile, Docs)
> Branch: `feature/session-16b-pwa-cicd`

## Verdict

**0 echte BLOCKER. 2 Major-Findings (beide nicht-blockierend, eines = dokumentierte Tech-Debt) + einige Nits.**
PR kann gemergt werden — nichts deployt automatisch nach prod (deploy.yml ist hinter `environment: production`-Approval gated). **Vor dem ersten realen Roll-out** müssen M1 und M2 jedoch behoben/verifiziert sein, sonst startet das API-Image nicht und das Offline-API-Caching ist tot.

Geprüfte 5 Punkte: 1) Bugs · 2) Error-Handling · 3) Security-Basics · 4) Tests · 5) DSGVO.

---

## Findings

### M1 — Major (non-blocking): SW-Runtime-Cache-Regex verfehlt `/api/v1/` → NetworkFirst-Regel ist ein No-Op
`apps/web/next.config.mjs`:
```js
urlPattern: new RegExp(`^${apiCacheHost...}/api/(contacts|deals|leads)`)
```
Die API nutzt **URI-Versioning** (`main.ts`: `setGlobalPrefix('api')` + `enableVersioning({ type: URI, defaultVersion: '1' })`), echte Routen sind also `/api/v1/contacts`, `/api/v1/deals`, `/api/v1/leads` (verifiziert: `@Controller({ path: 'contacts', version: '1' })`). Das Pattern matcht `/api/contacts` **ohne** `v1` → die NetworkFirst-Regel greift nie, das Offline-Caching der CRM-Daten ist faktisch deaktiviert.

**Impact:** Funktional — eine PWA-Kern-Funktion (Offline-Lesezugriff) ist still tot. Kein Crash, kein Security-Risiko. Die zugehörigen Laufzeit-ACs (Lighthouse, Offline) sind ohnehin deferred, daher non-blocking — aber **muss vor PWA-AC-Verifikation gefixt** werden.
**Fix:** Pattern auf `/api/v\\d+/(contacts|deals|leads)` (oder `/api/v1/...`) anpassen.

### M2 — Major (non-blocking): API-Prod-Image startet wie geschrieben nicht (TD-S16b-01, Kommentar überverkauft)
`apps/api/Dockerfile` `CMD ["node", "apps/api/dist/main.js"]`. `nest build` mit dem **swc-Builder transpiliert datei-weise, bündelt nicht** — `require('@nextgen/db')` bleibt im Output. Zur Laufzeit löst das via Workspace-Symlink auf `packages/db` auf, dessen `main: ./src/index.ts` ist (gilt analog für `@nextgen/utils|types`). Plain `node` kann keine `.ts` requiren → Crash beim ersten Workspace-Import.
Der Dockerfile-Kommentar behauptet, das Image „relies on the registered swc runtime hook" — **ein solcher Hook ist im CMD/Config nirgends registriert** (kein `-r`, kein Loader). Die Aussage „adequate for staging" stimmt damit nicht: das Image läuft ohne Hook gar nicht.

**Impact:** Würde jeder echte API-Container-Start scheitern. Non-blocking für den Merge, weil: (a) als TD-S16b-01 dokumentiert + auf Session 17 vertagt, (b) `nest build`/`docker build` **selbst** laufen durch (Crash erst zur Laufzeit), (c) deploy.yml deployt nur nach manueller `production`-Approval.
**Fix vor Roll-out:** Entweder Workspace-Packages precompilen (`build` + `exports.import/require` je Package, sauberer Weg laut Runbook) **oder** den behaupteten Runtime-Hook tatsächlich registrieren (`node -r @swc/register apps/api/dist/main.js`) und im Image bereitstellen. Mindestens den irreführenden „relies on … hook"-Kommentar korrigieren.

### Nits (kein Handlungsbedarf zum Merge)
- **N1 — PWAUpdatePrompt Reload-Race:** `applyUpdate()` postet `SKIP_WAITING` und ruft sofort `window.location.reload()`, statt auf `controllerchange` zu warten. Kommentar sagt „reload once the new worker takes control" — passiert real synchron, nicht „once". Meist unkritisch (Reload re-fetcht ohnehin), aber der idiomatische Pattern ist Listener auf `navigator.serviceWorker.addEventListener('controllerchange', () => reload())`. Kosmetik/Robustheit.
- **N2 — `web-deployment.yaml` `readOnlyRootFilesystem: true`:** Next.js (standalone) schreibt ggf. nach `.next/cache` (ISR/Image-Optimization). Falls genutzt, ohne `emptyDir`-Mount potenziell Fehler. Aktuell vermutlich kein ISR → ok; vor Launch verifizieren oder writable `emptyDir` für `/app/.next/cache` mounten.
- **N3 — `api-deployment.yaml` ohne `readOnlyRootFilesystem`:** Inkonsistent zur web-Deployment (die es setzt). Vermutlich bewusst (Prisma/swc-Source-Schreibpfade), aber undokumentiert. Konsistenz/Kommentar wünschenswert.
- **N4 — `networkpolicy.yaml` Egress 443/5432/6379 ohne `to:`-Selektor:** erlaubt HTTPS/DB/Redis-Egress an **jedes** Ziel. Der Kommentar „hardens the AI web-scraper SSRF surface (TD-S14-02)" ist leicht überzogen — interne HTTPS-Dienste auf 443 bleiben erreichbar. Echte SSRF-Härtung (Cloud-Metadata 169.254.169.254:80) ist allerdings tatsächlich geblockt (Port 80 nicht in der Allowlist). Funktional ok, Kommentar präzisieren.
- **N5 — backup-cronjob:** `DATABASE_URL` als `--dbname=` Arg → Passwort in Prozess-Args (`ps`) sichtbar im Backup-Container. Geringes Risiko (isolierter Job-Pod). Optional `PGPASSWORD`/`.pgpass` nutzen.

---

## Was gut ist (positiv vermerkt)

- **Error-Handling solide:** `RedisService.ping()` und `HealthController.checkDatabase()` fangen alles ab und werfen nie; `onModuleDestroy` ist status-guarded mit `disconnect()`-Fallback bei `quit`-Fehler (TD-S16a-02 sauber gelöst). 503 nur bei DB-Ausfall, Redis-Ausfall degradiert graceful — korrekte Readiness-Semantik.
- **Health-Split korrekt umgesetzt:** Liveness ohne DB (kein Restart-Sturm bei DB-Blip), Readiness mit DB + Redis. k8s-Probes zeigen passend (`/api/health` liveness, `/api/health/ready` readiness API); Web-`/api/health`-Route existiert (verifiziert).
- **Security-Basics stark:** Container non-root (UID 1001) + `drop: [ALL]` + `allowPrivilegeEscalation:false` + `seccompProfile: RuntimeDefault`; Default-Deny-NetworkPolicy; `secrets.example.yaml` rein als Template (keine echten Werte); deploy.yml checkt `head_sha` des grünen CI-Runs aus (shippt exakt das Getestete) und gated den Roll-out hinter manueller `production`-Approval.
- **Tests:** Neuer Source ist abgedeckt — `health.controller.spec.ts` (Liveness + 3 Readiness-Pfade inkl. 503), `redis.service.spec.ts` (ping ×3 + shutdown ×3 inkl. quit-throw-Fallback), `PWAUpdatePrompt.test.tsx` (5 Fälle inkl. First-Install-Suppression + SKIP_WAITING). Keine Coverage-Lücke im neuen Code.
- **DSGVO:** EU-`nodeSelector` auf allen Workloads + Backup-CronJob; Backup in EU-Bucket, 30-Tage-Retention; keine neue PII-in-Logs eingeführt. Konform.

---

## Empfehlung

✅ **Merge freigegeben.** Keine BLOCKER. Vor `docs`-Tasks zwei kleine Korrekturen empfohlen (billig, gleicher PR):
1. **M1 fixen** (`/api/v1/`-Regex) — einzeiliger Fix, verhindert eine still-tote PWA-Funktion.
2. **M2-Kommentar korrigieren** (irreführende swc-Hook-Behauptung im Dockerfile), restliche Precompile-Arbeit bleibt korrekt auf Session 17 (TD-S16b-01).

N1–N5 sind optionale Politur für den Pre-Launch-Pass.
