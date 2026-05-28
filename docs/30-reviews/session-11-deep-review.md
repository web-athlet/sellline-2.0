---
title: "Deep Review Session 11 — M6 E-Mail-Sync"
session: 11
type: deep
status: blockers
date: 2026-05-22
blockers: 2
warnings: 20
info: 8
summary: "Deep Review Session 11: 2 BLOCKER (OAuth-Callback ohne @Public, CRLF-Header-Injection), 20 WARNINGS, 8 INFO. Quality-Gate gruen."
---

# Deep Review Session 11 — M6 E-Mail-Sync

**Status:** BLOCKED — 2 BLOCKER

**Reviewer-Hinweis:** Initial wurde der Tier-3 Review an den `reviewer`-Subagenten delegiert (Opus). Trust-but-verify ergab, dass 3 von 4 gemeldeten BLOCKERN frei erfunden waren (Token-Refresh angeblich unverschluesselt — tatsaechlich Zeile 180 `this.encryption.encrypt(...)`; PubSub-JWT angeblich nicht verifiziert — tatsaechlich `verifyIdToken` in Zeile 245; XSS via `dangerouslySetInnerHTML` — der Pattern existiert in keiner Frontend-Datei). Das Review-Doc wurde nie geschrieben. Dieser Bericht ist eine inline Neudurchfuehrung mit Code-Verifikation jeder Behauptung.

---

## Scope

git diff main..HEAD: 39 Dateien, +4430 / -64 Zeilen.

| Bereich | Dateien |
|---------|---------|
| Backend (Service/Controller/Worker/DTO) | 11 |
| Backend (Spec) | 2 |
| Schema + Migration | 2 |
| Frontend (Component/Page/Spec) | 12 |
| Frontend (Lib + Spec) | 2 |
| Config / Env / Docs | 10 |

---

## Quality-Gate

| Check | Ergebnis |
|-------|----------|
| Turbo typecheck | PASS (12/12 cached) |
| Turbo lint | PASS (No ESLint warnings/errors) |
| API vitest | PASS — 386/386 Tests, 33 Files |
| API coverage | Stmt **85.69%** / Branch **80.31%** / Func **89.70%** / Lines **85.69%** — alle ≥ 80%-Threshold |
| Web vitest | PASS — 469/469 Tests, 57 Files |
| Web coverage | Stmt **89.84%** / Branch **81.98%** / Func **68.19%** (≥ 64% Threshold, Tech-Debt #32) / Lines **89.84%** |
| npm audit | 7 high (alle pre-existing, akzeptiert auf `critical` Threshold, Tech-Debt #2), 25 moderate, 6 low, 0 critical |

**Quality-Gate ist GRUEN.** Die BLOCKER betreffen funktionale Korrektheit + Header-Injection und sind durch Tests/Audit nicht abgedeckt.

---

## Security (OWASP)

### BLOCKER

#### X1 [BLOCKER] OAuth-Callback-Endpoints fehlen `@Public()` — OAuth-Flow ist gebrochen

**Datei:** `apps/api/src/modules/email/email.controller.ts:77-83` (Gmail) + `:99-105` (Outlook)
**OWASP:** A01 Broken Access Control (umgekehrt: Endpoint zu strikt, blockiert legitime Requests)

```typescript
@Get('gmail/callback')
@Redirect()
async gmailCallback(@Query('code') code: string, @Query('state') state: string) {
  await this.sync.handleGmailCallback(code, state);
  ...
}
```

**Problem:** `JwtAuthGuard` ist global registriert (`apps/api/src/app.module.ts:67`) und `JwtStrategy` extrahiert ausschliesslich aus `Authorization: Bearer` Header (`jwt.strategy.ts:14` — `ExtractJwt.fromAuthHeaderAsBearerToken()`). Google/Microsoft redirecten den Browser per HTTP 302 zu `/api/v1/email/gmail/callback?code=...&state=...`. Top-level Navigation kann keinen Bearer-Header setzen → Request kommt ohne JWT an → 401.

Das Design ist absichtlich stateful: Der `state`-Token enthaelt den `userId` via HMAC (`buildStateToken` Zeile 38-42), also ist JWT auf dem Callback **nicht noetig** und der State alleine garantiert die Bindung an den initiierenden User. Aber der `@Public()` Decorator fehlt — `handleGmailCallback` wird **nie aufgerufen**, weil der Guard vorher 401 wirft.

**Impact:** Gmail- und Outlook-Connect funktionieren in jeder Umgebung mit aktivem JwtAuthGuard nicht. Die Acceptance Criteria AC-1 (E-Mail-Sync) und AC-3 (Senden) sind ohne erfolgreiches Connect technisch unerreichbar. Nur deshalb nicht in Tests gefangen, weil keine E2E-/Integration-Tests den OAuth-Roundtrip ueben (vgl. T2).

**Fix:**
```typescript
import { Public } from '../auth/decorators/public.decorator';

@Public()
@Get('gmail/callback')
@Redirect()
async gmailCallback(...) { ... }

@Public()
@Get('outlook/callback')
@Redirect()
async outlookCallback(...) { ... }
```

State-Token-Verifikation (`verifyStateToken` mit 10 min TTL und HMAC-SHA256) bleibt die alleinige Auth-Schicht und ist dafuer auch ausgelegt.

---

#### X2 [BLOCKER] Email-Header-Injection (CRLF) via `inReplyToMessageId`

**Datei:** `apps/api/src/modules/email/email-sync.service.ts:403-405` + DTO `apps/api/src/modules/email/dto/send-email.dto.ts:35-36`
**OWASP:** A03 Injection (SMTP/Email-Header-Injection)

```typescript
// send-email.dto.ts
@IsOptional()
@IsString()
inReplyToMessageId?: string;          // keine CRLF-Pruefung
```

```typescript
// email-sync.service.ts:403-405
const inReplyTo = opts.inReplyToMessageId
  ? `In-Reply-To: ${opts.inReplyToMessageId}\r\nReferences: ${opts.inReplyToMessageId}\r\n`
  : '';
```

**Problem:** Ein authentifizierter User kann `inReplyToMessageId = "<orig@x.com>\r\nBcc: attacker@evil.com"` senden. Resultat ist ein RFC-2822-Block mit injizierten Headern:

```
In-Reply-To: <orig@x.com>
Bcc: attacker@evil.com
References: <orig@x.com>
Bcc: attacker@evil.com
```

Gmails `users.messages.send` versendet die Mail mit dem zusaetzlichen Bcc / beliebigen Custom-Headern.

**Severity:** Der Angreifer kompromittiert hauptsaechlich sein **eigenes** Gmail-Konto (eigenes Token, eigene Sends) — laterale Wirkung ist beschraenkt. Aber:
- Datenleak-Vektor: Bcc-Kopien aller eigenen ausgehenden Mails an Attacker-Adresse (ohne dass die CRM-UI das anzeigt).
- Spoofing: `Reply-To: anyone@victim.com` injizieren, sodass Antworten auf legitime ausgehende CRM-Mails an Attacker-kontrollierte Inbox gehen.
- Header-Forgery: `From:` ueberschreiben — Gmail erlaubt das eingeschraenkt, aber `Subject:` und andere lassen sich injizieren.
- Compliance-Bruch: Audit-Logs zeigen "User X hat Mail an Bob gesendet", tatsaechlich ging auch eine Kopie an Attacker.

**Reasoning:** Der Vektor ist eingeschraenkt, weil ein Angreifer schon API-Auth braucht. Aber er ist klassischer Code-Smell und ein OWASP-A03-Pattern. Ein 2-Zeilen-Fix wiegt das Risiko nicht auf.

**Fix:**
```typescript
// send-email.dto.ts
@IsOptional()
@IsString()
@Matches(/^[^\r\n]*$/, { message: 'inReplyToMessageId must not contain CRLF' })
inReplyToMessageId?: string;
```

Oder server-seitig in `sendGmailMessage` strippen: `opts.inReplyToMessageId?.replace(/[\r\n]/g, '')`.

`subject` ist sicher (wird vor Interpolation base64-encoded, Zeile 412). `to`/`cc`/`bcc` sind sicher (`@IsEmail({}, { each: true })` filtert CRLF).

---

### WARNING

#### S1 [WARNING] `GCP_PUBSUB_SA_EMAIL` Fail-Open in Produktion

**Datei:** `email-sync.service.ts:240`

```typescript
async verifyPubSubToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  if (!process.env.GCP_PUBSUB_SA_EMAIL) return true; // dev: skip verification
  ...
}
```

Wenn das Env-Var in Produktion versehentlich nicht gesetzt ist (Deploy-Fehler, Secret-Manager-Outage), akzeptiert der Webhook beliebige Requests. Der Fallback war fuer dev gedacht, ist aber an `NODE_ENV` nicht gebunden.

**Fix:** Bei Service-Init throwen, wenn `NODE_ENV=production` und `GCP_PUBSUB_SA_EMAIL` leer ist; oder im Webhook bei Prod fail-closed:
```typescript
if (!process.env.GCP_PUBSUB_SA_EMAIL) {
  if (process.env.NODE_ENV === 'production') return false;
  return true;
}
```

---

#### S2 [WARNING] `EMAIL_OAUTH_STATE_SECRET` Fallback auf `'dev-secret'`

**Datei:** `email-sync.service.ts:71-72`

```typescript
this.stateSecret = process.env.EMAIL_OAUTH_STATE_SECRET ?? process.env.JWT_SECRET ?? 'dev-secret';
```

Wenn beide Env-Vars fehlen, faellt die HMAC-Key auf den Literal-String `'dev-secret'` — oeffentlich bekannt, jeder Angreifer kann State-Tokens forgen, CSRF-Schutz auf Callback ist gebrochen, fremde Gmail-Konten koennten an beliebige User-IDs gebunden werden.

**Fix:** In Constructor pruefen und fail-fast:
```typescript
if (process.env.NODE_ENV === 'production' && !process.env.EMAIL_OAUTH_STATE_SECRET) {
  throw new Error('EMAIL_OAUTH_STATE_SECRET required in production');
}
```

---

#### S3 [WARNING] Outlook `clientState` wird gesetzt aber nicht verifiziert

**Datei:** `email-webhooks.controller.ts:97-99` + `email-sync.service.ts:573`

Subscription wird mit `clientState: buildStateToken(userId, ...)` angelegt (Service Zeile 573), aber der Webhook prueft nur Praesenz:

```typescript
const clientState = notification.clientState;
if (!clientState) continue;
```

Microsoft Graph nutzt `clientState` als "Shared Secret" der Subscription — wir sollten den Token via `verifyStateToken()` validieren und den extrahierten `userId` gegen den per `subscriptionId` ermittelten User abgleichen. Ohne das genuegt einem Angreifer die Kenntnis einer `subscriptionId` (UUID — schwer zu raten, aber UUIDs leaken historisch oft) um den Webhook missbrauchen.

**Fix:** Nach `findFirst({ where: { outlookSubscriptionId } })`:
```typescript
const { valid, userId: stateUserId } = verifyStateToken(clientState, this.stateSecret);
if (!valid || stateUserId !== user.id) continue;
```

---

#### S4 [WARNING] Kein Rate-Limiting auf Webhook-Endpoints (Tech-Debt #38)

ThrottlerGuard ist global mit `100 req/60s` konfiguriert (`app.module.ts:38`). Webhooks sind `@Public` — sie werden vom Throttler getroffen, aber IP-gebundene Budget-Trennung ist unspezifisch. Ein Angreifer kann mit invaliden Tokens spam-DoSsen, ohne Authentifizierungs-Aufwand. Bereits in Tech-Debt #38 erfasst, hier nochmal explizit.

**Fix:** `@Throttle({ default: { ttl: 60_000, limit: 1000 } })` direkt auf den Webhook-Methods setzen oder ueber eine eigene `WebhookThrottlerGuard` mit IP-+Account-Bucket.

---

#### S5 [WARNING] Nicht-Constant-Time HMAC-Vergleich in `verifyStateToken`

**Datei:** `email-sync.service.ts:52`

```typescript
if (expected !== mac) return { valid: false, userId: '' };
```

Standard-String-Equality ist anfaellig fuer Timing-Oracle. Bei HMAC-SHA256 mit unbekanntem Secret ist die Ausbeute praktisch null, aber Best-Practice ist `crypto.timingSafeEqual`.

**Fix:**
```typescript
const expected = createHmac('sha256', secret).update(`${userId}:${ts}`).digest();
const actual = Buffer.from(mac, 'hex');
if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return { valid: false, userId: '' };
```

---

#### S6 [WARNING] `getOutlookAccessToken` `obtained_at` fehlt beim Initial-Save (Tech-Debt #39)

**Datei:** `email-sync.service.ts:482` (initial save) vs. `:524` (refresh check)

Beim ersten OAuth-Save:
```typescript
data: { outlookTokenEncrypted: this.encryption.encrypt(JSON.stringify(tokens)) },
```

`tokens` enthaelt `expires_in: 3600` von Microsoft, aber kein `obtained_at`. Bei der ersten Refresh-Pruefung Zeile 524:
```typescript
const obtainedAt = creds.obtained_at ?? Date.now();
```

faellt der Code auf `Date.now()` zurueck — der Token wird also als gerade erst erhalten betrachtet, obwohl er tatsaechlich beim ersten User-Request schon teil-abgelaufen ist. Bei 1h-TTL und ersten Use nach > 1h schickt der Service einen abgelaufenen Token an Graph → 401.

Bereits Tech-Debt #39, hier nochmal explizit weil 2-Zeilen-Fix.

**Fix:**
```typescript
data: { outlookTokenEncrypted: this.encryption.encrypt(JSON.stringify({ ...tokens, obtained_at: Date.now() })) },
```

---

#### S7 [WARNING] `extractGmailBody` produziert XSS-anfaelliges `bodyHtml` fuer kuenftige Konsumenten

**Datei:** `email-sync.service.ts:323`, `:668`

```typescript
bodyEncrypted: this.encryption.encrypt(parsed.bodyHtml || parsed.bodyText),
```

Das gespeicherte `bodyHtml` (eingehende E-Mail) wird unsanitiert encrypted. **Aktuell** kein Display-Pfad in der App: `THREAD_SELECT` (`email.service.ts:10-26`) listet `bodyEncrypted` nicht — das Frontend bekommt nur `bodyPreview` (regex-stripped Text, von React escaped). Also **derzeit kein XSS exposure**.

ABER: Stored XSS-Bombe liegt verschluesselt im DB. Sobald in Session 12 (Campaigns) oder spaeter ein Endpoint wie `GET /emails/:id/body` ergaenzt wird, ist der Pfad sofort ausnutzbar (Sender controlled HTML).

**Fix-Vorschlag:** Sanitizer entweder beim Schreiben (DOMPurify server-side via `isomorphic-dompurify` oder `sanitize-html`) oder als striktes Render-Pattern dokumentieren ("`bodyEncrypted` darf nur in `<iframe sandbox>` gerendert werden"). ADR notwendig.

---

#### S8 [WARNING] Outlook Subscription `lifecycleNotificationUrl` fehlt

**Datei:** `email-sync.service.ts:565-575`

Microsoft Graph Subscriptions unterscheiden zwischen Change-Notifications und Lifecycle-Events (reauthorize, missed, subscriptionRemoved). Wenn nur `notificationUrl` gesetzt ist, gehen Lifecycle-Events verloren — wir bemerken nicht, wenn die Subscription gedroppt wurde, ausser ueber den 2-Tage-Renewal-Cron (`renewExpiredOutlookSubscriptions`).

**Fix:** `lifecycleNotificationUrl: notifUrl` mit anlegen und im Webhook auf `value[].lifecycleEvent` reagieren.

---

## DSGVO

#### D1 [WARNING] Plaintext-PII in `Email`-Tabelle

**Datei:** `packages/db/prisma/schema.prisma:290-313`

| Feld | Inhalt | Verschluesselt? |
|------|--------|------------------|
| `bodyEncrypted` | E-Mail-Body | ✅ AES-256-GCM |
| `subject` | Betreff | ❌ Plaintext |
| `bodyPreview` | Erste 200 Zeichen | ❌ Plaintext |
| `fromAddress`, `toAddresses`, `cc`, `bcc` | E-Mail-Adressen | ❌ Plaintext |

`subject` und `bodyPreview` enthalten regelmaessig PII (Namen, IDs, Konditionen). Begruendung im Code: Volltextsuche und Inbox-Listing brauchen plaintext. Trade-off ist sinnvoll, aber:
- BCC ist im CRM operativ ueberfluessig — Recipient-Tracking macht der Mail-Provider. Datenminimierung gem. DSGVO Art. 5(1)(c) verletzt.
- `bodyPreview` 200 Zeichen ist die maximale Lecks-Oberflaeche; oft erscheint dort die Anrede + Sales-Pitch.

**Fix:** BCC weglassen (nur fuer Send-Pfad nutzen, nicht persistieren). ADR fuer plaintext-`subject`/`bodyPreview` mit Begruendung. Optional: `bodyPreview` auf 80 Zeichen kuerzen.

---

#### D2 [WARNING] `summarizeThread` sendet User-PII an OpenAI ohne Consent-Flow

**Datei:** `email.service.ts:181-231`

Bis zu 500 Zeichen pro Mail × N Mails (mind. 5) gehen entschluesselt als `JSON.stringify(decrypted)` an `gpt-4o`. OpenAI ist US-Anbieter (third-country transfer). Frontend (`AISummaryBanner.tsx:42-48`) zeigt nur "Anzeigen" — kein Consent-Hinweis.

DSGVO erfordert entweder:
- Standard Contractual Clauses + Transfer Impact Assessment (TIA) — operativ; gibt es?
- Oder explizite Einwilligung gem. Art. 49(1)(a) vor jedem Transfer.

**Fix (Code):**
- Settings-Toggle "AI-Funktionen aktivieren" persistieren.
- Vor dem Call pruefen, andernfalls 403 mit Hinweis.
- AuditLog-Eintrag pro Summary-Generierung.

**Fix (Org):** OpenAI-DPA verifizieren, in `docs/50-runbooks/dpa-status.md` (existiert?) dokumentieren.

---

#### D3 [WARNING] Kein AuditLog beim Lesen verschluesselter Body-Inhalte

**Datei:** `email.service.ts:86-102` (`getThread`), `:181-231` (`summarizeThread`)

Beide Methoden decrypten `bodyEncrypted` (direkt oder via Preview-Fallback). DSGVO Art. 30 verlangt Verarbeitungsverzeichnis; Best-Practice: Read-Access auf entschluesselte PII protokollieren.

`getThread` markiert die Mails als gelesen, schreibt aber keinen AuditLog. `summarizeThread` schreibt nichts.

**Fix:** AuditLog-Eintrag pro `getThread`/`summarizeThread` (User, Action, ThreadId, Timestamp). Siehe `AuditLog` Schema aus Session 1.

---

#### D4 [WARNING] Kein Hard-Delete-Pfad fuer DSGVO Art. 17 (Right-to-Erasure)

**Datei:** `email.controller.ts` — kein `@Delete` Endpoint fuer Emails/Threads

`Email.deletedAt` existiert (Soft-Delete-Pattern). Aber:
- Es gibt keinen Endpoint, der `deletedAt` setzt (`disconnectGmail`/`disconnectOutlook` setzen nur Tokens auf null, **keine** Emails werden geloescht).
- Es gibt keinen Retention-Job, der soft-deleted Emails physisch entfernt.
- `Email_userId_fkey ON DELETE CASCADE` greift erst bei User-Loeschung.

Bei DSAR (Data Subject Access Request) "loesche alle Mails von/an meine Adresse" haben wir keinen technischen Pfad. ADR + Implementierung notwendig.

**Fix:**
- `DELETE /api/v1/email/threads/:id` (Soft-Delete) — User-eigene Threads.
- BullMQ-Job `email-purge` taeglich: `Email.deleteMany({ where: { deletedAt: { lt: dateMinus30d } } })`.
- Pro-User Bulk-Delete via DSAR-Endpoint (Session 15).

---

## Performance

#### P1 [WARNING] `listThreads` Pagination-Total ist immer ≤ limit

**Datei:** `email.service.ts:74-76`

```typescript
const total = await this.prisma.email.count({
  where: { ...where, id: { in: threads.map((t) => t.id) } },
});
```

Der Filter `id: { in: threads.map(t => t.id) }` schraenkt den COUNT auf genau die IDs ein, die ohnehin in `threads` schon zurueckgegeben wurden. `total` ist also immer gleich `threads.length` (≤ `limit`). Damit ist `pages: Math.ceil(total / limit)` immer 1 → UI zeigt nie mehr als eine Seite, "Mehr laden" wird zu frueh deaktiviert.

**Fix:** Distinct-Threads korrekt zaehlen:
```typescript
// Option A: Raw query
const [{ count }] = await this.prisma.$queryRaw<[{ count: bigint }]>`
  SELECT COUNT(DISTINCT "threadId")::int as count
  FROM "Email"
  WHERE "userId" = ${userId} AND "deletedAt" IS NULL
  ${dealId ? Prisma.sql`AND "dealId" = ${dealId}` : Prisma.empty}
`;
const total = Number(count);

// Option B: distinct fetch (teurer bei N>>limit)
const allThreadIds = await this.prisma.email.findMany({
  where, distinct: ['threadId'], select: { threadId: true },
});
const total = allThreadIds.length;
```

---

#### P2 [WARNING] `summarizeThread` ohne Caching — wiederholte $0.05-Calls

**Datei:** `email.service.ts:181-231`

Jeder Klick auf "Anzeigen" → frischer GPT-4o-Call. Bei `max_tokens: 600` Output + ~5 Mails × 500 Zeichen Input ~$0.05/Call. User scrollt zurueck → erneut Anzeigen → $0.05. Keine Idempotenz-Kontrolle.

**Fix:** `Email`-Modell um `aiSummaryJson Json?` + `aiSummaryEmailCount Int?` erweitern. In `summarizeThread`: Cache-Check (`if existing && existing.aiSummaryEmailCount === emails.length`). Bei neuer Mail im Thread automatisch invalidieren.

---

#### P3 [WARNING] Index auf `User.outlookSubscriptionId` fehlt

**Datei:** `schema.prisma` User-Model + Migration `20260522120000_email_sync_fk`

`email-webhooks.controller.ts:105-109` macht `findFirst({ where: { outlookSubscriptionId } })` pro Webhook-Call. Ohne Index = Full Table Scan auf `User`. Bei 10k Users + 100 Webhooks/Min schmilzt die DB.

**Fix:** Migration `2026XXXXXXXXXX_user_outlook_subscription_idx`:
```sql
CREATE INDEX IF NOT EXISTS "User_outlookSubscriptionId_idx" ON "User"("outlookSubscriptionId");
```

---

#### P4 [WARNING] Index auf `User.outlookSubscriptionExpiresAt` fehlt (asymmetrisch zu Gmail)

**Datei:** `schema.prisma` + Migration

Migration legt `User_gmailWatchExpiresAt_idx` an, vergleichbarer Outlook-Index fehlt — `renewExpiredOutlookSubscriptions` (Zeile 601-613) filtert nach diesem Feld.

**Fix:** Im selben Migration-Schritt wie P3:
```sql
CREATE INDEX IF NOT EXISTS "User_outlookSubscriptionExpiresAt_idx" ON "User"("outlookSubscriptionExpiresAt");
```

---

#### P5 [WARNING] Serielle Loops in Renewal/Poll-Jobs

**Datei:** `email-sync.service.ts:229-233`, `:354-358`, `:615-619`

```typescript
for (const u of users) {
  await this.setupGmailWatch(u.id).catch(...);
}
```

Bei 10k Users mit je ~200 ms Gmail-API-Call → 2000 s Lauf des cron-Jobs. Renewal-Cron laeuft alle 24h, der Job wuerde > 33 min belegen — fuer den 03:00-UTC-Slot meist OK, aber `pollAllUsers` (alle 5 min!) wuerde ueberlappen.

**Fix:** Concurrency-Limit (z.B. `p-limit` Lib oder eigene Batch-Iteration):
```typescript
const limit = pLimit(20);
await Promise.all(users.map((u) => limit(() => this.setupGmailWatch(u.id))));
```

---

#### P6 [WARNING] WS `email:count_updated` pro empfangener Mail (Burst-Storm)

**Datei:** `email-sync.service.ts:339-342`

```typescript
this.events.emitEmailReceived({ ... });
const unread = await this.prisma.email.count({ where: { userId, isRead: false, deletedAt: null } });
this.events.emitEmailCountUpdated({ userId, unreadCount: unread, ts: Date.now() });
```

Sync-Job von Gmail kann in einem Webhook 50 Mails ergeben → 50× DB-Count + 50× WS-Emit. Frontend bekommt ein Flackern + 50× Re-Render der NavRail-Badge.

**Fix:** Per-User Debouncing (300 ms Window) oder Emit nur am Job-Ende, nicht pro Mail.

---

## Architektur

#### A1 [WARNING] Bracket-Notation Zugriff auf private Members

**Datei:** `email-webhooks.controller.ts:105` + `:113`

```typescript
const user = await this.sync['prisma'].user.findFirst(...);
await this.sync['syncQueue'].add(...);
```

Umgeht TypeScripts `private`-Modifier. Encapsulation gebrochen, IDE-Refactoring (Rename) bricht silent.

**Fix:** Public Methoden in `EmailSyncService`:
```typescript
async findUserIdByOutlookSubscriptionId(id: string): Promise<string | null> {
  const user = await this.prisma.user.findFirst({ where: { outlookSubscriptionId: id }, select: { id: true } });
  return user?.id ?? null;
}

async enqueueOutlookMessage(userId: string, messageId: string): Promise<void> {
  await this.syncQueue.add('outlook', { type: 'outlook', userId, messageId });
}
```

Controller ruft diese auf.

---

#### A2 [WARNING] `email-sync.service.ts` 770 Zeilen — Single-Responsibility-Verletzung

**Datei:** `apps/api/src/modules/email/email-sync.service.ts`

Verantwortlichkeiten: Gmail-OAuth, Outlook-OAuth, Gmail-Watch, Outlook-Subscription, Gmail-Send, Gmail-Parser, Outlook-Fetch, Deal-Matching, BullMQ-Setup, PubSub-JWT, State-Token-HMAC. Schwer zu reviewen, Test-Mock-Footprint massiv (15+ Felder im `prismaMock`).

**Fix-Vorschlag:** Spalten in `GmailService`, `OutlookService`, `EmailMatcherService`, `OAuthStateService`. `EmailSyncService` als Orchestrator zurueckschneiden. Refactor in Folge-Session, kein blocker.

---

#### A3 [WARNING] Inbox-UI abonniert `email:received` / `email:count_updated` nicht

**Datei:** `apps/web/app/(dashboard)/inbox/page.tsx`

`events.gateway.ts:166-172` emittet pro neuer Mail. Inbox-Seite hat **keinen** Socket-Hook — sieht neue Mails erst beim manuellen Refresh oder beim 60s-Poll von `getUnreadCount`. Tech-Debt #10 wurde zwar geschlossen (Badge live), aber der Inbox-Content selbst ist nicht reaktiv.

**Fix:** `useEmailSocket()` Hook analog `use-leads-socket.ts`, der bei `email:received` `queryClient.invalidateQueries(['email-threads'])` triggert.

---

#### A4 [WARNING] `outlookTokenEncrypted` Race-Condition zwischen Initial-Save und Refresh

**Datei:** `email-sync.service.ts:480-482` und `:546-549`

Beide Pfade schreiben `outlookTokenEncrypted = encrypt(JSON.stringify(...))` ohne optimistic-lock oder Versionsfeld. Wenn zwei parallele Anfragen den Token gleichzeitig refreshen (z.B. zwei BullMQ-Worker fuer denselben User), kann das letzte Write das erste ueberschreiben — wenn Microsoft refresh_token rotiert (was Microsoft tut), verliert man einen gueltigen refresh_token.

Gmail hat denselben Pfad (Zeile 178-181), aber `OAuth2Client` cached die Tokens in-process — die Race ist schmaler.

**Fix:** Distributed-Lock via Redis (BullMQ-Job-Locking nutzen — gleiche `jobId: refresh-outlook:${userId}`) oder optimistic-version-counter im Schema.

---

#### A5 [WARNING] `email.module.ts` re-deklariert `EncryptionService` nicht — nutzt CryptoModule **nicht** explicit

**Datei:** `apps/api/src/modules/email/email.module.ts`

Modul importiert nur `PrismaModule`, `EventsModule`, `BullModule`. Da `CryptoModule` mit `@Global()`-Pattern oder einer @Module-Konvention nicht explicit als global markiert ist (siehe `apps/api/src/common/crypto/crypto.module.ts`), funktioniert die Injection nur, weil `CryptoModule` in `AppModule.imports` steht und Nest die exportierten Provider in jedes downstream-Modul propagiert — **das ist nicht das Standard-Verhalten**.

Geprueft: `CryptoModule` ist NICHT `@Global`. Tests scheitern nicht, weil sie `EncryptionService` direkt im `Test.createTestingModule.providers` mockern. In Produktion funktioniert es nur, weil NestJS bei Injectables die App-weit registrierten Provider sieht — aber das ist fragiler Pfad.

**Fix-Vorschlag:** `EmailModule.imports.push(CryptoModule)`. Macht Abhaengigkeit explicit und faengt zukuenftige Umstrukturierungen ab.

> Hinweis: Wenn die Tests gruen sind und der App-Boot funktioniert, ist das streng genommen kein Bug — aber explicit ist besser.

---

#### A6 [INFO] `EmailService.sendOutlookMessage` ist private aber im Test als `syncMock.sendOutlookMessage` exposed

**Datei:** `email.service.spec.ts:49` vs `email.service.ts:159`

Test mockt `sendOutlookMessage` als wenn es auf `EmailSyncService` lebt — tatsaechlich ist es **privater Helper auf `EmailService`** (Zeile 159). Der Mock greift nie, weil der Service die echte Methode aufruft. Glueck, dass die `sendEmail`-Tests nur den Gmail-Pfad pruefen — Outlook-Send ist effektiv ungetestet.

---

## Test-Coverage

#### T1 [WARNING] `email-sync.service.ts` komplett aus Coverage exkludiert

**Datei:** `apps/api/vitest.config.ts:50`

```typescript
// Thin external-API adapter: wraps googleapis + Microsoft Graph; exercised by integration tests
'src/modules/email/email-sync.service.ts',
```

Begruendung "thin adapter" greift nicht: 770 Zeilen mit
- `buildStateToken` / `verifyStateToken` (pure functions, kritische Security-Logik)
- `parseGmailMessage` / `extractGmailBody` (pure parsing)
- `matchDealByAddress` (Prisma-Query, mockbar)
- `verifyPubSubToken` (mockbar)
- `onModuleInit` Cron-Setup (mockbar)

Die spec testet **diese** Methoden — die Coverage-Stats reflektieren das aber nicht, weil der File gar nicht im Include steht. Falsches Signal: "untested external" suggeriert nichts ist getestet, in Wahrheit ~30% der File.

**Fix:** Pure Helper (`buildStateToken`, `verifyStateToken`, `parseGmailMessage`, `extractGmailBody`) in `email-state-token.ts` / `gmail-parser.ts` extrahieren. Diese Files NICHT excluden. Dann ist Coverage akkurat.

---

#### T2 [WARNING] Keine Integration-Tests fuer OAuth-Roundtrip / Webhook-Flow

Es gibt:
- ✅ Unit-Tests fuer `buildGmailConnectUrl`, `buildOutlookConnectUrl`, `matchDealByAddress`, `parseGmailMessage`, `disconnectGmail`, `verifyPubSubToken`, `enqueueGmailSync`, `onModuleInit`.
- ❌ Keine Integration-Tests, die den HTTP-Flow `GET /gmail/callback?code=...&state=...` ausprobieren — sonst waere X1 (fehlende `@Public()`) gefangen worden.
- ❌ Keine Integration-Tests fuer `/webhooks/gmail` mit echtem Google-JWT-Token.
- ❌ Keine E2E-Tests fuer Compose → Send → Inbox-Listing.

`tests/integration/` existiert (siehe `pnpm-lock` Diff erwaehnt `@nextgen/integration-tests:typecheck`).

**Fix:** Mindestens einen Smoke-Test pro Modul-Endpoint via Supertest. OAuth-Callback mit gemockten Google-Token. Webhook-Endpoint mit gemockter Validation.

---

#### T3 [WARNING] `email.service.summarizeThread` Happy-Path nicht getestet

**Datei:** `email.service.spec.ts:201-230`

Drei Tests: OpenAI nicht konfiguriert (503), Thread mit < 5 Mails (skipped), leerer Thread (404). **Keiner** testet den eigentlichen GPT-4o-Call: Mock-OpenAI, Mock-Response, parse, return. Damit ist die `JSON.parse(raw)` Zeile 225 ungetestet — wenn GPT mal kein valides JSON liefert, crash zur Request-Zeit.

**Fix:** Mock `service.openai.chat.completions.create.mockResolvedValue({...})`, pruefe Return-Format.

---

## Code-Quality

#### I1 [INFO] `prompt=consent` fehlt bei Outlook OAuth

**Datei:** `email-sync.service.ts:443-450`

Gmail nutzt `prompt: 'consent'` (Zeile 122), garantiert refresh_token. Outlook lehnt sich auf `offline_access`-Scope. Bei Scope-Wechsel oder Account-Switch holt User u.U. keinen frischen refresh_token.

**Fix:** `prompt: 'consent'` in URLSearchParams (Zeile 443).

---

#### I2 [INFO] HTML-Strip via Regex ist fragil

**Datei:** `email-sync.service.ts:758`, `:656`, `email.service.ts:147`, `:200`

`.replace(/<[^>]+>/g, '')` versagt bei `<script>alert(1)</script>` mit Inhalt drin (Output: `alert(1)`), bei CDATA, bei `<!-- ... -->`. Aktuell unproblematisch (Output wird React-escaped), aber bei zukuenftiger Verwendung in Volltextsuche / AI-Prompts (was `summarizeThread` macht!) kann das HTML-Markup als "Befehl" interpretiert werden — Prompt Injection ueber unsanitiertes E-Mail-HTML.

**Fix:** `sanitize-html` mit `allowedTags: []` ist 2 Zeilen.

---

#### I3 [INFO] `EncryptionService` ohne AAD (Additional Authenticated Data)

**Datei:** `apps/api/src/common/crypto/encryption.service.ts:25-29`

```typescript
const cipher = createCipheriv(ALGORITHM, this.key, iv);
```

GCM-AAD bindet Ciphertext an Kontext (z.B. `userId:fieldName`). Ohne AAD koennte ein Angreifer mit DB-Write-Zugriff verschluesselte Tokens zwischen Usern swappen (substitution attack). Defense-in-Depth.

**Fix:** Signatur erweitern: `encrypt(plaintext: string, aad?: string)` — bei oauth-Tokens `aad = userId:gmailToken`.

---

#### I4 [INFO] `summarizeThread` ohne Zod-Validation der GPT-Response

**Datei:** `email.service.ts:225-230`

```typescript
return JSON.parse(raw) as {
  bullets: string[];
  suggestedReply: string;
  tone: 'friendly' | 'neutral' | 'urgent';
};
```

Cast statt Validation. Wenn GPT-4o mal `bullets: "..."` (String statt Array) liefert → Frontend `summary.bullets.map(...)` crashed. JSON-Mode reduziert Risiko, faengt es aber nicht ab.

**Fix:** `const AISummarySchema = z.object({ bullets: z.array(z.string()), suggestedReply: z.string().nullable(), tone: z.enum(['friendly','neutral','urgent']) });`

---

#### I5 [INFO] `ENCRYPTION_KEY` Validation: Regex case-insensitive, Error-Msg sagt "lowercase"

**Datei:** `encryption.service.ts:18-19`

```typescript
if (raw.length !== KEY_HEX_LENGTH || !/^[0-9a-f]+$/i.test(raw)) {
  throw new Error('ENCRYPTION_KEY must be exactly 64 lowercase hex chars');
}
```

Regex (`/i` flag) akzeptiert `ABCDEF`, Fehlermeldung verlangt "lowercase". Inkonsistent. Folge: User wird verwirrt sein.

**Fix:** Regex auf `/^[0-9a-f]+$/` (ohne `/i`) — oder Msg-Text korrigieren.

---

#### I6 [INFO] `EmailService.sendEmail` Provider-Routing ohne User-Wahl

**Datei:** `email.service.ts:124-130`

```typescript
if (user.gmailTokenEncrypted) {
  sentMessageId = await this.sync.sendGmailMessage(...);
} else if (user.outlookTokenEncrypted) {
  sentMessageId = await this.sendOutlookMessage(...);
} else {
  throw new ServiceUnavailableException(...);
}
```

User mit beiden Providern verbunden hat keinen UI-Pfad, Outlook zum Senden zu waehlen — Gmail gewinnt immer.

**Fix:** `SendEmailDto.provider?: 'gmail' | 'outlook'` mit Default-Logik.

---

#### I7 [INFO] `Email.bodyPreview.length === 200` Heuristik fuer "..."-Suffix

**Datei:** `apps/web/components/email/ThreadView.tsx:201`

```typescript
{email.bodyPreview}
{email.bodyPreview.length === 200 && '…'}
```

Wenn die Original-Mail exakt 200 Zeichen text hat, zeigt UI faelschlich "…". Triviale UX-Inkonsistenz.

**Fix:** Backend Flag `bodyTruncated: boolean` oder im Frontend ignorieren.

---

#### I8 [INFO] `inbox/page.tsx` searchTimeout Cleanup fehlt

**Datei:** `apps/web/app/(dashboard)/inbox/page.tsx:36-39`

```typescript
const searchTimeout = useRef<...>(null);
const handleSearch = (q: string) => {
  if (searchTimeout.current) clearTimeout(searchTimeout.current);
  searchTimeout.current = setTimeout(() => setSearch(q), 300);
};
```

Beim Unmount waehrend Timeout pending → `setState` auf unmounted component (Warning in React StrictMode).

**Fix:** `useEffect(() => () => searchTimeout.current && clearTimeout(searchTimeout.current), [])`.

---

## Verifikation der Subagent-Halluzinationen

Der initial delegierte `reviewer`-Subagent meldete 4 BLOCKER, von denen 3 frei erfunden waren:

| Subagent-BLOCKER | Tatsaechliche Code-Stelle |
|------------------|--------------------------|
| ❌ "S1: Token-Refresh schreibt unverschluesselt via `gmailAccessToken`" | `email-sync.service.ts:180` `data: { gmailTokenEncrypted: this.encryption.encrypt(JSON.stringify(credentials)) }` — verschluesselt |
| ❌ "S2: PubSub-JWT-Verifikation fehlt, nur 'TODO'-Kommentar" | `email-sync.service.ts:240-251` implementiert `verifyIdToken` + `payload.email === GCP_PUBSUB_SA_EMAIL`-Vergleich. Webhook ruft via `await this.sync.verifyPubSubToken(token)` auf — wirft 401 bei Invalidem Token |
| ❌ "X1: XSS via `dangerouslySetInnerHTML` in ThreadView:101 + AISummaryBanner:60" | Kein File enthaelt `dangerouslySetInnerHTML`. ThreadView rendert `{email.bodyPreview}` (React auto-escape). AISummaryBanner rendert `{b}` und `{summary.suggestedReply}` (React auto-escape) |
| ⚠️ "D1: Kein Hard-Delete-Endpoint" | Wahr (siehe D4 oben), aber Soft-Delete + Retention-Job ist akzeptables Pattern fuer DSGVO Art. 17 — Klassifikation als BLOCKER war zu streng. Hier als WARNING gefuehrt |

Lehre: Subagent-Outputs immer gegen den **tatsaechlichen Code** verifizieren, nicht gegen den Diff-Kontext. Insbesondere wenn der Subagent file-line-Referenzen liefert — die kann er hallucinieren ohne den File gelesen zu haben.

---

## Zusammenfassung

| Severity | Count |
|----------|-------|
| **BLOCKER** | **2** |
| WARNING | 20 |
| INFO | 8 |

**Empfehlung:** **BLOCK MERGE** bis X1 + X2 gefixt.

- **X1** ist ein funktionaler Bug — OAuth-Flow ist gebrochen in jedem Setup mit aktivem JwtAuthGuard. Wuerde beim ersten manuellen Test entdeckt. 2-Zeilen-Fix.
- **X2** ist eine reale Email-Header-Injection. Geringe laterale Wirkung (Angreifer beschaedigt vor allem eigenen Account), aber klassischer OWASP-A03-Pattern. 1-Zeilen-Fix per `@Matches`-Decorator.

**Fix-Branch-Vorschlag:** `fix/session-11-oauth-callback-and-header-injection` (von `feature/session-11-email` aus).

**Warnings als Tech-Debt** in CLAUDE.md aufnehmen (S1-S8, D1-D4, P1-P6, A1-A6, T1-T3 — bzw. Priorisierung):
- **Sofort, gemeinsam mit Fix-Branch:** S1, S2 (Prod-Fail-Open), P3, P4 (Index-Migration, weil ohne Migration die Konkurrenz-Hits aus Webhook P3 hochskalieren).
- **Session 15 (Security-Haerten):** S3, S4, S5, S6, S7, S8, A4, T2.
- **Session 12 (E-Mail-Campaigns):** D2, D3, P2 (Caching-Konzept transferierbar), I3.
- **Session 16a (Testing):** T1, T3, A6, I2, I4.
- **Folge-Refactor-Session:** A1, A2, A3, A5.
- **Backlog:** D1, D4, I1, I5-I8.
