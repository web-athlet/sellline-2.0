---
title: "Session 15 Summary — Security & DSGVO-Härtung"
tags: [session, summary, security, dsgvo, gdpr, audit-log, csrf, rate-limiting, rbac, lockout, hibp, dompurify]
status: completed
session: 15
last_updated: 2026-06-16
summary: "Querschnitt-Security-Härtung über alle Module: automatischer Audit-Log-Interceptor (+7-Jahre-Retention-Cron), DSGVO-Export (Art. 20, Streaming-ZIP) + Hard-Delete-Cron (Art. 17, env-gated), Redis-Throttler + Per-User-Guard, Security-Headers (Next-Middleware), CSRF (csrf-csrf, ADR-0003), zentraler HTML-Sanitizer, RBAC-Lückenschluss (TD#31), Dependabot+Snyk, Passwort-Policy (min-12 + Lowercase) + Account-Lockout + env-gated HIBP. Eine Migration (User.failedLoginAttempts/lockedUntil). Quality-Gate 10/10."
---

# Session 15 — Security & DSGVO-Härtung

## TLDR (5 Punkte)

1. **10 Security-Blocks umgesetzt** (Querschnitt, kein einzelnes Modul):
   - **Audit-Log**: globaler `AuditLogInterceptor` schreibt für jeden mutierenden Request (POST/PUT/PATCH/DELETE) eine `AuditLog`-Zeile — **re-nutzt das bestehende Schema** (`tableName/recordId/changes`, `{before,after}` im `changes`-JSON), redaktiert Secrets/PII, überspringt `/auth/*` + GET, schreibt fire-and-forget (Audit-Fehler bricht nie die Response). 7-Jahre-Retention-Cron (`@Cron 04:00 UTC`).
   - **DSGVO-Export** (Art. 20): `GET /api/v1/gdpr/export/:userId` streamt ein ZIP (`archiver`) mit user/contacts/deals/activities/emails/tasks/projects/audit-log/README; Authz = self **oder** ADMIN; auf den Datensubjekt-Scope (Ownership) begrenzt; E-Mail-Bodies entschlüsselt.
   - **Hard-Delete** (Art. 17): `@Cron 03:00 UTC`, **env-gated** (`GDPR_HARD_DELETE_ENABLED`, default false), purged soft-gelöschte `Person`/`Lead` nach Grace-Window (`GDPR_HARD_DELETE_GRACE_DAYS`, default 30), Audit **vor** Löschung (ohne Re-Speicherung der PII), FK-sichere Reihenfolge.
   - **Rate-Limiting**: Redis-Throttler-Store (`@nest-lab/throttler-storage-redis`, Fallback in-memory ohne `REDIS_URL`); Per-Route-Limits (Login 5/15m, Reset 3/h) + `UserThrottlerGuard` (Per-User-Tracker) für Export 1/24h und Campaign-Send 2/h.
   - **Security-Headers**: Next-Middleware setzt HSTS, X-Content-Type-Options, X-Frame-Options DENY, Referrer-Policy, Permissions-Policy + pragmatische CSP (`apps/web/lib/security-headers.ts`).
   - **CSRF**: `csrf-csrf` Double-Submit-Cookie (ADR-0003), Bearer-Requests + GET/HEAD/OPTIONS + Public/Auth-Bootstrap exempt, Token-Endpoint `GET /api/v1/auth/csrf`.
   - **DOMPurify**: zentraler `apps/web/lib/sanitize.ts`, am Campaign-Render-Site angewandt; TD#30 (Embed-Snippet-Attribut-Escaping) geschlossen.
   - **RBAC**: `@Roles(ADMIN, MANAGER)` auf `LeadsController` convert/enrich/delete (TD#31). **RLS bewusst deferred** (kein `tenant_id`, Single-Tenant — TD#19).
   - **Dependency-Scanning**: `.github/dependabot.yml` + `.github/workflows/snyk.yml` (benötigt `SNYK_TOKEN`).
   - **Passwort/Account**: Policy min-12 + Lowercase-Pflicht, Account-Lockout (5 Fehlversuche → 15 min), env-gated HIBP-Pwned-Check (k-anonymity). 2FA + 1h-One-Time-Reset waren bereits aus Session 2 vorhanden.

2. **Schema-Änderung** (eine Migration `20260616120000_session15_security`): `User.failedLoginAttempts Int @default(0)` + `User.lockedUntil DateTime?`. Audit re-nutzt bestehende Spalten; Hard-Delete nutzt bestehendes `deletedAt` — keine weiteren Felder nötig.

3. **Neue Env-Variablen**: `CSRF_SECRET` (Fallback JWT_SECRET), `GDPR_HARD_DELETE_ENABLED` (false), `GDPR_HARD_DELETE_GRACE_DAYS` (30), `HIBP_CHECK_ENABLED` (false), `AUDIT_RETENTION_YEARS` (7). Neue Deps: `archiver@6` (CJS), `csrf-csrf`, `@nest-lab/throttler-storage-redis`, `ioredis` (api), `isomorphic-dompurify` (web).

4. **Limitierungen / bewusst deferred**: (a) **Migration noch nicht angewendet** (lokale `DATABASE_URL` ungültig — wie TD#53). (b) **Postgres-RLS / Multi-Tenant** verschoben (kein `tenant_id`, TD#19). (c) **Nonce-basierte strikte CSP** deferred (braucht Next-Layout/Runtime-Wiring). (d) **HIBP** und **Live-Snyk** hinter Flags/Secrets, default OFF. (e) **HMAC-24h-Signed-Link via MinIO** für den Export — stattdessen direkter Stream (kein MinIO-Client in der API).

5. **Nächste Session (16a — Testing & Performance) braucht**: Migration mit echten Creds nachziehen; ggf. Frontend-CSRF-Header-Wiring falls Cookie-Flows hinzukommen; Integration-Tests für GDPR-Export-Stream + Throttler-429-Pfad; Review der Web-Functions-Coverage.

## Backend (`apps/api/src`)

| Datei | Rolle |
|-------|-------|
| `common/audit/audit-log.interceptor.ts` | Globaler Interceptor (APP_INTERCEPTOR), schreibt AuditLog für Mutationen. |
| `common/audit/audit.util.ts` | `redact`/`redactCapped` (PII/Secret-Redaktion, Date-Normalisierung, Size-Cap), `extractEntity`. |
| `common/audit/audit-retention.service.ts` | 7-Jahre-Retention-Cron. |
| `common/csrf/csrf.config.ts` | `doubleCsrf`-Konfiguration + `shouldSkipCsrf`-Prädikat. |
| `common/throttler/user-throttler.guard.ts` | `UserThrottlerGuard` (Per-User-Tracker) + Presets ONCE_PER_DAY/TWICE_PER_HOUR. |
| `modules/gdpr/gdpr.service.ts` | `collectExport` (Datensubjekt-Scope) + `writeArchive` (Streaming-ZIP). |
| `modules/gdpr/gdpr.controller.ts` | `GET /gdpr/export/:userId` (self/admin + Per-User-Throttle). |
| `modules/gdpr/hard-delete.service.ts` | Art.-17-Hard-Delete-Cron (env-gated, FK-sicher). |
| `modules/auth/services/pwned-password.service.ts` | HIBP-k-anonymity-Check (env-gated, fail-open). |
| `main.ts` | CSRF-Middleware nach cookieParser eingehängt. |
| `app.module.ts` | ThrottlerModule.forRootAsync (Redis-Store), APP_INTERCEPTOR, AuditModule, GdprModule. |

Geänderte Bestandsdateien: `auth.service.ts` (Lockout in Login + HIBP in register/reset/change), `auth.controller.ts` (`/auth/csrf` + per-route Throttles), `dto/{register,change-password,reset-password}.dto.ts` (min-12 + Lowercase), `leads.controller.ts` (`@Roles`), `campaigns.controller.ts` (Per-User-Throttle auf send), `forms.service.ts` (TD#30 Escaping).

## Frontend (`apps/web`)
- `middleware.ts` + `lib/security-headers.ts`: Security-Header auf allen Responses.
- `lib/sanitize.ts`: zentraler `sanitizeHtml` (Allow-List), angewandt in `campaigns/[id]/page.tsx`.

## CI
- `.github/dependabot.yml` (npm daily + github-actions weekly, grouped minor/patch).
- `.github/workflows/snyk.yml` (PR + weekly, fail on HIGH/CRITICAL, no-op ohne `SNYK_TOKEN`).

## Tests
- **Neu**: `audit.util.spec`, `audit-log.interceptor.spec`, `audit-retention.service.spec`, `gdpr.service.spec`, `gdpr.controller.spec`, `hard-delete.service.spec`, `user-throttler.guard.spec`, `csrf.config.spec`, `pwned-password.service.spec`, `leads.controller.spec`, `register.dto.spec` (api); `security-headers.test`, `sanitize.test` (web). Lockout-Tests in `auth.service.spec` ergänzt.
- **Quality-Gate 10/10 PASS**: 596 API-Tests, 537 Web-Tests; Coverage Lines API 91.1 % / Web 88.7 % / Utils 100 %; Branches ~81–83 %.

## Acceptance Criteria
| AC | Beschreibung | Status |
|----|-------------|--------|
| AC-030 | Mutierende Requests erzeugen AuditLog-Einträge (redaktiert) | ✅ |
| AC-031 | DSGVO-Export liefert vollständiges ZIP | ✅ |
| AC-032 | Hard-Delete-Cron idempotent + FK-Order (env-gated) | ✅ |
| Rate-Limiting | Login 5/15m, Reset 3/h, Export 1/24h, Send 2/h (Redis-Store) | ✅ |
| Security-Headers | 6 Header inkl. CSP in jeder Response | ✅ |
| CSRF | Blockiert Cookie-Mutationen ohne Token; Bearer exempt | ✅ |
| DOMPurify | Entfernt `<script>`/`onerror=`/`javascript:` | ✅ |
| Dependabot/Snyk | Konfiguriert (Snyk benötigt SNYK_TOKEN) | ✅ |
| HIBP | `password123`/policy abgelehnt; Pwned-Check env-gated | ✅ |
| 2FA | Bereits aus Session 2 (TOTP, 30-s-Fenster) | ✅ |
| RLS (Block 8) | **Deferred** — kein tenant_id (TD#19) | ⏸ |

## Tech-Debts (neu / Status)
- **[Done] TD#28** CORS Public-Submit — durch CSRF-Public-Skip + Bearer-Architektur abgedeckt; volles Cross-Domain-CORS weiter offen falls Embeds extern.
- **[Done] TD#30** HTML-Attribut-Injection im Embed-Snippet — `escapeHtmlAttr` in `forms.service.ts`.
- **[Done] TD#31** Fehlende `@Roles()` auf LeadsController convert/enrich/delete.
- **[Teil-Done] TD#38/#43** Rate-Limits Public/Tracking — globaler Throttler + Per-User-Guard; dedizierte IP-Limits auf Webhook/Tracking weiter möglich.
- **[Done] TD#44** Separates `CSRF_SECRET` dokumentiert (analog Tracking-Secret).
- **[Neu] TD-S15-01** Nonce-basierte strikte CSP (`script-src 'nonce-…'`) deferred — braucht Next-Layout/Runtime-Wiring.
- **[Neu] TD-S15-02** Postgres-RLS + Multi-Tenant-Modell deferred (kein `tenant_id`, TD#19).
- **[Neu] TD-S15-03** GDPR-Export: HMAC-24h-Signed-Link via MinIO statt direktem Stream (Skalierung großer Exporte).
- **[Offen] TD#57/TD-S14-03** DSGVO-Bewertung KI-Datenflüsse (OpenAI-Drittlandtransfer) — Doku/DPA weiterhin offen.
- **[Offen]** Migration `20260616120000_session15_security` mit echten Creds anwenden (wie TD#53).

## Nächste Session
**Session 16a — Testing & Performance**: Migration anwenden; Integration-Tests GDPR-Export-Stream + Throttler-429; Web-Coverage-Review; ggf. Frontend-CSRF-Wiring.
