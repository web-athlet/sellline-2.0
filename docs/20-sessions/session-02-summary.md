---
title: "Session 2 — Authentication & Authorization"
tags: [session, session-2, auth, jwt, rbac, 2fa, oauth]
status: completed
date: 2026-05-10
duration: ~halber Tag
model: claude-opus-4-7
thinking: think-harder
review: pending
last_updated: 2026-05-10
summary: "Vollstaendiges v3.0-Auth-System: JWT-15min + Refresh-Token-Family-Rotation mit Replay-Detection, TOTP-2FA (AES-256-GCM-encrypted), OAuth Google/Microsoft (feature-flagged), RBAC-Hierarchie, Rate-Limiting (10/15min/IP), Password-Reset-Flow, NextAuth-Frontend. 10/10 ACs erfuellt, 97 API-Tests (97.1% Coverage), 14 Web-Tests (100%)."
---

# Session 2 — Authentication & Authorization

## TLDR (5 Zeilen — Agents lesen NUR diese 5 Punkte)

1. **Gebaut:** Komplettes v3.0-Auth-System mit JWT-Access (15min, validiert `pwChangedAt` gegen DB), opaken Refresh-Tokens (30d) mit Family-Rotation und Replay-Detection (revoke gesamte Family), TOTP-2FA via `otplib`+`qrcode` (Secret AES-256-GCM-verschluesselt), OAuth Google+Microsoft (passport-google-oauth20 + passport-microsoft, feature-flagged), 4-Rollen-RBAC mit Hierarchie-Check, Rate-Limit 10/15min/IP via `@nestjs/throttler`, Password-Reset-Flow (1h, einmalig), Session-Invalidation in Tx bei PW-Change, NextAuth Credentials-Provider mit AccessToken-Handoff, 6 Auth-Pages, Middleware-Schutz. WS-JWT-Handshake-Guard schliesst Tech-Debt #1.
2. **Schema:** Keine Aenderungen — alle Felder waren in Session-1-Schema vorhanden (`User.password/passwordChangedAt/twoFactor*`/`gmail|outlookTokenEncrypted`, `RefreshToken.tokenHash/family/revokedAt/replacedByToken`, `PasswordReset.tokenHash/expiresAt/usedAt`). Keine Migration.
3. **Env-Vars:** 13 neu — `JWT_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, `ENCRYPTION_KEY` (64 Hex Pflicht), `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `COOKIE_DOMAIN`, `GOOGLE_OAUTH_*` (3), `MICROSOFT_OAUTH_*` (3). Alle in `.env.example` dokumentiert.
4. **Limitierungen:** OAuth2-E2E nur mit echten Google/Microsoft-Credentials testbar (ohne ENV → 503); MailService ist Stub (`[MAIL_STUB]`-pino-Log, echtes SMTP Session 12); Rate-Limit nur per IP, kein Per-User/CAPTCHA/Account-Lockout (Session 15); kein Refresh-Token-Cleanup-Cron (Session 15); `scripts/quality-gate.sh` existiert nicht im Repo (CLAUDE.md-Verweis stale).
5. **Naechste Session braucht:** Session 3 (Navigation/App-Shell) kann `useSession()`/`session.user.{role,twoFactorEnabled}` direkt nutzen; `apiFetch()` aus `lib/api-client.ts` ist HTTP-Wrapper-ready (Refresh-on-401 NICHT implementiert — falls Bedarf in Session 3 nachziehen). Public-Pages-Liste in `middleware.ts` ggf. erweitern. Kein Schema-Change erforderlich.

---

## Was wurde implementiert

### Backend (`apps/api`) — 41 neue Source-Dateien

**Infrastructure-Module**
- `PrismaModule` + `PrismaService` (`apps/api/src/prisma/`): wrapped `getPrisma()` aus `@nextgen/db`, `OnModuleInit` connect / `OnModuleDestroy` disconnect. Schliesst Tech-Debt A1 aus Session-1-Deep-Review.
- `CryptoModule` + `EncryptionService` (`apps/api/src/common/crypto/`): AES-256-GCM, Key aus `ENCRYPTION_KEY` (exakt 64 Hex). Format: `base64(12-Byte-IV | 16-Byte-AuthTag | Ciphertext)`. Throwt bei Tampered-Ciphertext via GCM-AuthTag-Verifikation.
- `MailModule` + `MailService` (`apps/api/src/mail/`): Stub. Loggt Reset-URLs via pino mit Marker `[MAIL_STUB]`. Email-Masking. Echtes SMTP deferred bis Session 12.

**AuthModule** (`apps/api/src/modules/auth/`)
- `AuthService`: register, login, loginAfter2FA, refresh, logoutByCookie, logoutAll, forgotPassword, resetPassword, changePassword, getMe, generate2FA, verify2FA, disable2FA, oauthSync. Signiert 3 JWT-Typen (access 15m / pre-2fa 1m / setup-2fa 5m).
- `RefreshTokenService` (`services/`): opake 64-Hex-Tokens (NICHT JWT), bcrypt-hashed (cost 10), Cookie-Format `${userId}.${rawHex}`. Rotation: neuer RT erbt `family`, alter RT bekommt `revokedAt + replacedByToken=newId`. **Replay-Detection**: Wiederverwendung eines revokten Tokens → `updateMany({where: {family, revokedAt: null}, data: {revokedAt: now}})` + Audit-Log-Warning.
- `TwoFactorService` (`services/`): TOTP via `otplib.authenticator` (window 1, step 30s), Secret AES-256-GCM-verschluesselt, QR-Code via `qrcode.toDataURL(otpauth://...)`.
- 3 JWT-Strategies (`strategies/`): `jwt` (Standard, validiert `pwChangedAt` gegen DB), `jwt-pre-2fa` (1min, nach Login pre-2FA), `jwt-setup-2fa` (5min, Admin-Pflicht-Setup). Alle teilen `JWT_SECRET`, Trennung via `type`-Claim.
- 2 OAuth-Strategies (`strategies/`): `passport-google-oauth20` + `passport-microsoft`. **Feature-flagged in `auth.module.ts`**: registriert nur wenn `*_OAUTH_CLIENT_ID`-ENV gesetzt.
- 6 Guards (`guards/`): `JwtAuthGuard` (global via `APP_GUARD`, Opt-Out per `@Public()`), `JwtPre2FAGuard`, `JwtSetup2FAGuard`, `RolesGuard` (numerisch hierarchisch ADMIN(4) > MANAGER(3) > SALES_REP(2) > READ_ONLY(1)), `GoogleOAuthGuard`, `MicrosoftOAuthGuard` (letztere werfen `ServiceUnavailable` 503 wenn ENV fehlt).
- 3 Decorators (`decorators/`): `@Roles()`, `@CurrentUser()`, `@Public()`.
- 6 DTOs (`dto/`) mit class-validator: login, register, forgot-password, reset-password, change-password, two-factor. Password-Policy: min. 8 Zeichen, 1 Grossbuchstabe, 1 Ziffer, 1 Sonderzeichen.
- `AuthController` exposed alle Spec-Endpoints unter `/api/v1/auth/*` mit URI-Versioning.

**App-Level**
- `app.module.ts`: `ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])`, globaler `JwtAuthGuard` + `ThrottlerGuard` via `APP_GUARD`. Sensitive Endpoints: `@Throttle({ default: { limit: 10, ttl: 900_000 } })` = 10/15min/IP.
- `main.ts`: `cookie-parser`, `helmet`, globale `ValidationPipe({whitelist, transform, forbidNonWhitelisted})`, `setGlobalPrefix('api')`, URI-Versioning defaultVersion `'1'`.
- `events.gateway.ts`: implementiert `OnGatewayConnection.handleConnection` — verifiziert `client.handshake.auth.token` (Fallback `Authorization: Bearer`) per `JwtService`, attached `client.data.user`, disconnect bei Failure. Closes Tech-Debt #1.
- `health.controller.ts`: `@Public()` ergaenzt damit globaler JwtAuthGuard nicht greift.

### Frontend (`apps/web`) — 13 neue Dateien

- `lib/api-client.ts`: fetch-Wrapper mit Bearer-Auth, `credentials: include`, JSON-Parsing, ApiError-Wrapping.
- `lib/auth-options.ts`: NextAuth Credentials-Provider. `authorize()` proxied zu API `/auth/login`. **Akzeptiert auch reine `accessToken`-Handoffs** nach OAuth/2FA-Flows (validiert via `/auth/me`). JWT-Session-Strategy. Session-Payload: `accessToken`, `preAuthToken`, `setupToken`, `user.{id,email,name,role,twoFactorEnabled}`.
- `types/next-auth.d.ts`: Module-Augmentation fuer Session/User/JWT.
- `app/api/auth/[...nextauth]/route.ts`: NextAuth Handler.
- `middleware.ts`: schuetzt alle Nicht-Auth-Routes per `getToken()`, redirected anonyme Requests auf `/login?callbackUrl=…`.
- `app/providers.tsx` + `app/layout.tsx`: SessionProvider-Wrapper.
- Auth-Pages (Route-Group `(auth)/`): `login` (E-Mail/PW + OAuth-Buttons), `register` (zxcvbn-Strength-Bar), `forgot-password` (Anti-Enumeration), `reset-password?token=…` (mit Confirm-Field), `2fa-challenge` (6-stelliger Code), `2fa-setup` (QR + Verify).
- `app/auth/oauth-callback/page.tsx`: empfaengt `?at=…` von API-Callbacks → ruft `signIn('credentials', { accessToken })` fuer NextAuth-Handoff.
- `app/settings/security/page.tsx`: 2FA-Status, Change-Password, Logout-All-Sessions.
- `login/reset-password/oauth-callback` in `<Suspense>` wegen `useSearchParams()` (Next-14-CSR-Bailout).

### Tests
- 97 API-Tests (vorher 16 → +81): EncryptionService Roundtrip+Tamper, RefreshTokenService Rotate+Replay+RevokeAll, TwoFactorService Generate/Verify/QR/Encrypt-Roundtrip, JwtStrategy pwChangedAt-Mismatch, RolesGuard-Hierarchie, AuthService 26 Specs (alle Endpoints inkl. transactions), AuthController 21 Specs, EventsGateway 8 Specs (inkl. neue Handshake-Guard-Tests), Health 3, Crypto 5, PrismaService 1, JwtAuthGuard 2.
- 14 Web-Tests (vorher 7 → +7): `apiFetch`-Wrapper komplett (200/204/Error/Auth-Header/Content-Type/Credentials).

---

## Schema-Aenderungen

Keine. Alle Felder bereits in Session-1-Schema vorhanden. Keine Migration.

## Neue Env-Variablen

| Variable | Beschreibung | Pflicht |
|----------|--------------|---------|
| `JWT_SECRET` | Signiert alle 3 JWT-Typen (>=32 Chars) | Ja |
| `JWT_ACCESS_TTL` | Access-Token TTL (default `15m`) | Nein |
| `JWT_REFRESH_TTL` | Refresh-Token TTL (default `30d`) | Nein |
| `ENCRYPTION_KEY` | AES-256-GCM Key, exakt 64 Hex-Chars. Verlust bricht 2FA + OAuth. | Ja |
| `NEXTAUTH_SECRET` | NextAuth Session-JWT Secret | Ja |
| `NEXTAUTH_URL` | App Base URL | Ja |
| `COOKIE_DOMAIN` | Optionale Cookie-Domain (leer = aktueller Host) | Nein |
| `GOOGLE_OAUTH_CLIENT_ID` / `_SECRET` / `_CALLBACK_URL` | OAuth Google (sonst 503) | Nein |
| `MICROSOFT_OAUTH_CLIENT_ID` / `_SECRET` / `_CALLBACK_URL` | OAuth Microsoft (sonst 503) | Nein |

## Test-Coverage

| Package | Tests | Statements | Branches | Functions | Lines |
|---------|-------|-----------|----------|-----------|-------|
| `apps/api` | 97 | 97.1% | 91.14% | 97.75% | 97.1% |
| `apps/web` | 14 | 100% | 100% | 100% | 100% |
| `packages/db` | 3 | unveraendert | — | — | — |
| `packages/utils` | 7 | unveraendert | — | — | — |

Threshold (>=80% alle Achsen) **erfuellt**. Coverage-Ausschluesse in `apps/api/vitest.config.ts`: DTOs (decorator-only, nichts zu testen), 1-Liner-AuthGuard-Subclasses (jwt-pre-2fa/setup-2fa/google-oauth/microsoft-oauth), thin Passport-Adapter-Strategies (google/microsoft/jwt-pre-2fa/jwt-setup-2fa). Begruendung: keine eigene Logik, nur Framework-Verdrahtung — werden bei realer OAuth/Login-E2E exercised.

## Bekannte Limitierungen

1. **OAuth2-E2E nur mit echten Credentials testbar** — Strategies komplett implementiert + unit-getestet (Token-Encrypt, User-Upsert), aber realer Google/Microsoft-Flow benoetigt registrierte OAuth-Apps. Im Dev ohne Credentials liefern `/auth/google`+`/auth/microsoft` 503 (feature-flagged).
2. **NextAuth-Handoff via accessToken** — `authorize()` akzeptiert sowohl `email/password` als auch `accessToken`-only (fuer OAuth/2FA-Returns). Im Bedarfsfall robuster mit dedicated Provider loesbar.
3. **MailService ist Stub** — loggt Reset-URLs via pino mit Marker `[MAIL_STUB]`. Real SMTP in Session 12.
4. **Rate-Limit nur per IP** — kein Per-User-Limit, kein CAPTCHA, kein Account-Lockout. Geplant Session 15.
5. **Refresh-Token-Cleanup-Cron fehlt** — abgelaufene RTs werden nicht aktiv geloescht. Geplant Session 15.
6. **Kein `scripts/quality-gate.sh` im Repo** — CLAUDE.md verweist darauf, das Skript existiert nicht. Manuell via `pnpm -r exec pnpm typecheck/lint/test` + `pnpm -w run format:check` + `pnpm --filter @nextgen/api build && pnpm --filter @nextgen/web build` ausgefuehrt — alle PASS. Skript-Erstellung als Tooling-TODO.

## ACs-Status (10/10 ✅)

- [x] AC-1: Registrieren/Einloggen/Ausloggen funktionieren — Endpoints + Frontend-Pages.
- [x] AC-2: JWT-Token-Rotation — `RefreshTokenService.rotate` testet, alter RT wird revoked.
- [x] AC-3: Token-Replay invalidiert ganze Familie — `updateMany family revokedAt:null → now` + Audit-Log-Warning.
- [x] AC-4: 2FA Setup/Validation/Disable — generate/verify/validate/disable Endpoints + Frontend-Pages.
- [x] AC-5: Rate-Limiting 10/15min/IP — `@Throttle({default: {limit: 10, ttl: 900_000}})` auf login/register/forgot-password/2fa-validate.
- [x] AC-6: Password-Reset 1h gueltig, einmalig — `expiresAt: 60*60*1000`, `usedAt`-Flag in TX gesetzt.
- [x] AC-7: Nach PW-Change alle RTs revoked, aktuelle Session bleibt (ausser logout-all) — `changePassword`-TX revoked alle alten + issued frische pair.
- [x] AC-8: OAuth-Flows + AES-256-GCM Token-Encrypt — `oauthSync` encrypted accessToken+refreshToken JSON in `gmailTokenEncrypted`/`outlookTokenEncrypted`.
- [x] AC-9: RBAC-Guard prueft Role-Hierarchie — `RolesGuard` mit numerischem Ranking + tested.
- [x] AC-10: Admin-2FA-Pflicht — Login returns `{requires2FASetup: true, setupToken}` fuer Admins ohne 2FA.

## Tech-Debt geschlossen
- **#1** (JWT-WS-Handshake): `events.gateway.ts.handleConnection` implementiert. **Erledigt.**
- **A1** aus Session-1-Deep-Review (PrismaClient Singleton-Disconnect-Lifecycle): `PrismaService` mit `OnModuleInit/OnModuleDestroy`. **Erledigt.**

## Tech-Debt offen (Session-2-Findings, kein BLOCKER)

| ID | Beschreibung | Geplant |
|----|--------------|---------|
| TD-2-1 | OAuth2-E2E nur mit echten Credentials testbar | Session 15 |
| TD-2-2 | NextAuth-Handoff via `accessToken` in `authorize()` | Session 15 |
| TD-2-3 | MailService ist Stub | Session 12 |
| TD-2-4 | Rate-Limit nur per IP | Session 15 |
| TD-2-5 | Refresh-Token-Cleanup-Cron fehlt | Session 15 |
| TD-2-6 | `scripts/quality-gate.sh` existiert nicht | Tooling-TODO |

## Review

Datei: docs/30-reviews/session-2-light-review.md (noch ausstehend — User soll `/review-light` in neuer Session ausfuehren).
Ergebnis: ausstehend.
