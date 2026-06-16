---
title: "Session 15 — Tier-3 Deep Review (Security & DSGVO-Härtung)"
tags: [review, deep-review, tier-3, security, dsgvo, owasp, session-15]
status: completed
session: 15
reviewer: "Claude Opus 4.8 (isolierter Review-Kontext)"
date: 2026-06-16
verdict: "PASS — 0 BLOCKER. 2 Medium-Findings (DSGVO), 5 Low/Observations als Tech-Debt."
---

# Session 15 — Tier-3 Deep Review

> **Ergebnis: ✅ PASS — 0 BLOCKER.** Merge nach Approval zulässig.
> Methodik: Jeder Befund wurde direkt gegen den Quellcode verifiziert (kein
> Vertrauen auf Summary-Claims). Verifiziert: `tsc --noEmit` (API) PASS,
> 52/52 neue Security-Specs PASS, FK-Sicherheit Hard-Delete gegen Schema geprüft.

## Scope

Diff `main..HEAD` (52 Dateien, +1932/-35). Querschnitt-Security-Härtung:
Audit-Log-Interceptor + Retention, GDPR-Export (Art. 20) + Hard-Delete-Cron
(Art. 17), Redis-Throttler + Per-User-Guard, Security-Headers/CSP, CSRF
(csrf-csrf), zentraler DOMPurify-Sanitizer, RBAC-Lückenschluss (TD#31),
Passwort-Policy + Account-Lockout + env-gated HIBP, Dependabot + Snyk.

## Verifikations-Log

| Prüfung | Ergebnis |
|---------|----------|
| `tsc --noEmit` (apps/api) | ✅ EXIT 0 (generierter Prisma-Client enthält `failedLoginAttempts`/`lockedUntil`) |
| 52 neue Security-Specs (audit, csrf, throttler, gdpr, hard-delete, pwned, leads) | ✅ 52/52 PASS |
| Hard-Delete FK-Sicherheit (Person/Lead) gegen `schema.prisma` | ✅ korrekt (s. u.) |
| CSRF Session-Binding-Cookie `rt` existiert (`REFRESH_COOKIE`) | ✅ `auth.controller.ts:31` |
| GDPR-Export Authz (self/admin) + globaler `JwtAuthGuard` | ✅ vorhanden |
| Migration `20260616120000_session15_security` ↔ `schema.prisma` | ✅ konsistent (Felder = SQL) |

---

## OWASP Top 10 — Bewertung

- **A01 Broken Access Control** — GDPR-Export `self ∨ ADMIN` (`gdpr.controller.ts:25`), `JwtAuthGuard` global (`app.module.ts:90`), RBAC-Lücke auf `LeadsController` geschlossen (`leads.controller.ts:37/43/49`). ✅
- **A02 Cryptographic Failures** — bcrypt cost 12 (Login/Register/Change), AES-256-GCM für E-Mail-Bodies, `safeDecrypt` fail-soft im Export. ✅
- **A03 Injection / XSS** — zentraler DOMPurify-Allow-List-Sanitizer (`sanitize.ts`), Embed-Attribut-Escaping (`forms.service.ts:106`, TD#30). ✅
- **A04 Insecure Design** — Hard-Delete env-gated + Grace-Window + Audit-vor-Löschung; Export-Stream statt Buffer. ✅ (Anmerkungen: M1/M2 unten)
- **A05 Security Misconfiguration** — helmet + CSP/HSTS/X-Frame DENY/Permissions-Policy (`security-headers.ts`). ⚠️ `script-src 'unsafe-inline'` (L3 / TD-S15-01).
- **A07 Auth Failures** — Account-Lockout (5 → 15 min), Login/Reset-Throttles, 2FA (Session 2), timing-floor bei forgot-password. ✅ (L1/L2 unten)
- **A08 Data Integrity** — CSRF Double-Submit (`__Host-csrf` in Prod), Snyk + Dependabot. ✅
- **A09 Logging Failures** — Audit-Interceptor für alle Mutationen. ⚠️ PII-Minimierung (M1) + Export nicht auditiert (M2).
- **A10 SSRF** — kein neuer Egress in Session 15 (HIBP ist statisches Host + k-anonymity). Web-Scraper-SSRF bleibt TD-S14-02 (Session 14). ✅ für Scope.

---

## Findings

### 🔴 BLOCKER — keine (0)

### 🟡 M1 (Medium, DSGVO) — Audit-Log speichert vollständige PII-Payloads für 7 Jahre
`audit.util.ts:2` redaktiert nur **Secret-benannte** Keys
(`pass/token/secret/2fa/otp/code/credential/authorization`), **nicht** PII wie
`email`/`firstName`/`lastName`/`phones`. Der Interceptor schreibt
`{ before:null, after:redactCapped(response), payload:redactCapped(req.body) }`
(`audit-log.interceptor.ts:67-71`) — also volle Request- und Response-Körper
jeder Mutation, inkl. Kontakt-PII, mit 7-Jahre-Retention.

- **Konflikt:** projekteigene Konvention „Keine PII in Logs (email, name, phone)"
  (CLAUDE.md) + DSGVO Art. 5(1)(c) Datenminimierung. Ein Audit-Trail darf PII
  enthalten (Art. 5(2)/30 Rechenschaft), aber denormalisierte Vollkopien jedes
  Payloads über 7 Jahre sind exzessiv vs. „nur geänderte Felder".
- **Kein BLOCKER:** Tabelle ist DB-seitig zugriffsgeschützt, bewusster Audit-Trail.
- **Empfehlung (Session 16a):** entweder PII-Felder zusätzlich redaktieren bzw.
  hashen, oder Audit auf geänderte Felder/Diff begrenzen; Rechtsgrundlage +
  Aufbewahrung im ROPA dokumentieren. → **neuer Tech-Debt TD-S15-04**.

### 🟡 M2 (Medium, DSGVO) — DSGVO-Datenexporte werden nicht auditiert
Der Audit-Interceptor verarbeitet nur `POST/PUT/PATCH/DELETE`
(`audit-log.interceptor.ts:10,30`). Der Export ist ein `GET`
(`gdpr.controller.ts:19`) → **kein Audit-Eintrag**. Damit ist die sensible
Handlung „wer hat wessen personenbezogene Daten exportiert/wann" nicht
nachvollziehbar. Hard-Delete dagegen wird korrekt explizit auditiert
(`hard-delete.service.ts:88`).

- **Empfehlung:** expliziter `auditLog.create` im `GdprController.export`
  (`action: 'GDPR_EXPORT'`, `recordId = userId`, **ohne** die exportierten Daten).
  → **neuer Tech-Debt TD-S15-05**.

### 🟢 L1 (Low) — `reset-password` ohne Per-Route-Throttle + O(100) bcrypt-Schleife
`reset-password` (`auth.controller.ts:111-116`) trägt **kein** `@Throttle` (nur
`register`/`login`/`forgot-password` haben Per-Route-Limits). `resetPassword`
lädt bis zu 100 offene Tokens und bcrypt-vergleicht jeden
(`auth.service.ts:274-286`, cost 10). Bei globalem 100/min-IP-Limit ⇒ bis ~10k
bcrypt-Ops/min/IP — CPU-Amplifikation. Token-Bruteforce bleibt durch 32-Byte-
Zufall + 1h-TTL infeasibel.
- **Empfehlung:** `@Throttle(RESET_THROTTLE)` auch auf `reset-password`; mittelfr.
  selektiver Token-Lookup statt Vollscan. (Vollscan stammt aus Session 2.)

### 🟢 L2 (Low) — Account-Lockout: Ziel-DoS + minimale User-Enumeration
`auth.service.ts:119-121` wirft bei gesperrtem Konto eine **andere** Meldung
(„Account temporarily locked") als bei falschem Passwort („Invalid credentials")
⇒ Existenz-Orakel. Zudem kann ein Angreifer mit bekannter E-Mail das Opfer durch
5 Fehlversuche gezielt aussperren (Lockout-DoS). Bekannter Lockout-Trade-off.
- **Empfehlung:** generische Fehlermeldung; optional exponential backoff/CAPTCHA
  statt harter Sperre. Niedrige Priorität.

### 🟢 L3 (Low) — CSP `script-src 'unsafe-inline'`
`security-headers.ts:23` erlaubt Inline-Skripte ⇒ schwächt XSS-Schutz. Bereits
als **TD-S15-01** (Nonce-CSP) erfasst. Akzeptabel als Übergang.

### 🟢 L4 (Info) — Doppelter Throttle-Guard auf Export/Send
`@UseGuards(UserThrottlerGuard)` + globaler `ThrottlerGuard` werten beide das
`@Throttle`-Metadatum aus ⇒ Limit greift sowohl per-User als auch per-IP
(zwei getrennte Storage-Keys). Funktional korrekt, leicht redundant. Kein Fix nötig.

### 🟢 L5 (Info) — HIBP fail-open & env-gated
`pwned-password.service.ts` gibt bei Netzwerkfehler/disabled `false` zurück
(`:31,:38`). Bewusst, dokumentiert (default OFF). Akzeptabel.

---

## Positiv hervorzuheben (verifiziert)

- **Hard-Delete FK-Sicherheit korrekt:** `Person` → `Activity.personId` wird
  explizit auf `null` gesetzt (`hard-delete.service.ts:60`), `CampaignContact`
  hat `onDelete: Cascade` (`schema.prisma:476`), `DealParticipants` ist implizites
  M2M (Cascade). `Lead` hat keine eingehenden FKs. Transaktional + idempotent.
- **CSRF korrekt verdrahtet:** Session-Binding an real existierendes `rt`-Cookie,
  Bearer/GET/Public-Skip sauber getrennt (`csrf.config.ts`), `__Host-`-Prefix nur
  in Prod (http-Dev-Fallback).
- **Audit-Interceptor fire-and-forget:** Audit-Fehler bricht nie die Response
  (`audit-log.interceptor.ts:76`); Secret-Redaktion + Size-Cap + Zirkular-Guard
  in `redact()` sauber getestet.
- **Export-Streaming** ohne Voll-Pufferung (`archiver.pipe(res)`), `safeDecrypt`
  fail-soft, Datensubjekt-Scope über Ownership begrenzt.

---

## Fazit

```
=== DEEP REVIEW ERGEBNIS ===
BLOCKER: 0
✅ Deep Review bestanden — PR kann nach Approval gemergt werden
```

Solide, vollständig getestete Security-Session. Keine Merge-Blocker. Zwei
Medium-DSGVO-Punkte (M1 PII-Minimierung im Audit, M2 Export-Auditierung) und
ein Low-Härtungspunkt (L1 reset-password-Throttle) sind als Tech-Debt für
Session 16a aufzunehmen — kein Sicherheits-Showstopper.

### Neue Tech-Debts
- **TD-S15-04** — Audit-Log: PII-Minimierung (Felder redaktieren/hashen oder
  Diff-only) + ROPA-Dokumentation der 7-Jahre-Retention. (M1)
- **TD-S15-05** — DSGVO-Export auditieren (`GDPR_EXPORT`, ohne Nutzdaten). (M2)
- **TD-S15-06** — `@Throttle(RESET_THROTTLE)` auf `reset-password` + selektiver
  Token-Lookup statt 100er-bcrypt-Vollscan. (L1)
