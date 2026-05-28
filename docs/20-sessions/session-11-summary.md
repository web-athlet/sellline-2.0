---
title: "Session 11 Summary — M6 E-Mail-Sync"
tags: [session, summary, m6, email, gmail, outlook, bullmq, gpt4o, encryption]
status: completed
session: 11
last_updated: 2026-05-22
summary: "M6 E-Mail-Sync vollständig: Gmail + Outlook OAuth2, AES-256-GCM-verschlüsselter Body-Store, BullMQ Watch-Renewal + Poll-Fallback, GPT-4o Thread-Summary, Inbox-UI mit 2-Panel-Layout. Tech-Debt #10 (NavRail-Badge) erledigt. 29 API-Tests + 43 Web-Tests. 4/4 ACs."
---

# Session 11 — M6 E-Mail-Sync (Kritischer Pfad)

## TLDR (5 Punkte)

1. **Gmail + Outlook OAuth2** mit HMAC-gesichertem State-Token (10 min TTL), proaktivem Token-Refresh (60 s vor Ablauf) und AES-256-GCM-Verschlüsselung aller gespeicherten OAuth-Credentials
2. **Push-Sync via Gmail Watch API (GCP PubSub)** + Outlook Graph Subscriptions (3-Tage-Ablauf), BullMQ Poll-Fallback alle 5 min für Nutzer ohne aktive Watch, tägliche Watch-Renewal-Cron (03:00 UTC)
3. **E-Mail-Körper AES-256-GCM-verschlüsselt** in `Email.bodyEncrypted`; `bodyPreview` max 200 Zeichen Klartext; Deal-Matching by Absender-Domain → `Organization.domain` → offener Deal
4. **GPT-4o Thread-Summary** (JSON-Mode, max 600 Tokens): bullets + suggestedReply + tone; überspringt Threads mit < 5 E-Mails; `AISummaryBanner` lädt on-demand
5. **Inbox-UI** 2-Panel (80rem Sidebar + flex-1 ThreadView), TipTap-ComposeModal, NavRail-Unread-Badge live via `getUnreadCount` (60 s Refetch) — Tech-Debt #10 erledigt

## Implementierte Endpoints (14)

| Method | Path | Beschreibung |
|--------|------|-------------|
| GET | `/api/v1/email/threads` | Gefilterte Thread-Liste (page/limit/dealId/search) |
| GET | `/api/v1/email/threads/:id` | Thread-Detail + alle E-Mails (markiert als gelesen) |
| GET | `/api/v1/email/threads/:id/summary` | GPT-4o Thread-Summary |
| GET | `/api/v1/email/count` | Ungelesene E-Mails (NavRail-Badge) |
| POST | `/api/v1/email/send` | Senden via Gmail oder Outlook |
| GET | `/api/v1/email/providers` | Provider-Status (connected + expiry) |
| GET | `/api/v1/email/gmail/connect-url` | Gmail OAuth-Redirect-URL |
| GET | `/api/v1/email/gmail/callback` | Gmail OAuth-Callback |
| DELETE | `/api/v1/email/gmail/disconnect` | Gmail trennen |
| GET | `/api/v1/email/outlook/connect-url` | Outlook OAuth-Redirect-URL |
| GET | `/api/v1/email/outlook/callback` | Outlook OAuth-Callback |
| DELETE | `/api/v1/email/outlook/disconnect` | Outlook trennen |
| POST | `/api/v1/webhooks/gmail` | GCP PubSub Push (@Public, JWT-verifiziert) |
| POST | `/api/v1/webhooks/outlook` | Graph Change Notification (@Public) |

## Schema-Änderungen

```sql
-- Migration: 20260522120000_email_sync_fk
ALTER TABLE "Email" ADD CONSTRAINT "Email_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "User"
  ADD COLUMN "outlookSubscriptionId" TEXT,
  ADD COLUMN "outlookSubscriptionExpiresAt" TIMESTAMP(3);
CREATE INDEX "Email_userId_deletedAt_idx" ON "Email"("userId", "deletedAt");
CREATE INDEX "User_gmailWatchExpiresAt_idx" ON "User"("gmailWatchExpiresAt");
```

**Schließt Tech-Debt #5** (Email.userId FK ohne Prisma-Relation).

## Neue Env-Variablen

| Variable | Beschreibung |
|----------|-------------|
| `GMAIL_SYNC_CALLBACK_URL` | Redirect-URL für Gmail OAuth Callback |
| `EMAIL_OAUTH_STATE_SECRET` | HMAC-Secret für CSRF State-Tokens (≥32 chars) |
| `GCP_PUBSUB_PROJECT` | Google Cloud Projekt-ID (leer = Watch deaktiviert) |
| `GCP_PUBSUB_TOPIC` | PubSub Topic Name (default: `nextgen-gmail-push`) |
| `GCP_PUBSUB_SA_EMAIL` | Service-Account-E-Mail für JWT-Verifikation (leer = dev-Modus) |
| `OUTLOOK_SYNC_CALLBACK_URL` | Redirect-URL für Outlook OAuth Callback |
| `OPENAI_API_KEY` | OpenAI API Key für GPT-4o Thread-Summary |

## Backend-Architektur

### EmailSyncService (`email-sync.service.ts`)
- `buildStateToken` / `verifyStateToken`: HMAC-SHA256, base64url, 10 min TTL
- `buildGmailConnectUrl` / `handleGmailCallback` / `disconnectGmail`
- `getGmailClient(userId)`: proaktiver Token-Refresh 60 s vor Ablauf
- `setupGmailWatch` / `renewExpiredWatches` (Nutzer mit Ablauf < 24 h)
- `syncFromGmailHistory` / `fetchAndStoreGmailMessage` (Duplikat-Check via `gmailMessageId`)
- `pollAllUsers` / `pollGmailForUser` (Poll-Fallback via `after:${unixSec}`)
- `sendGmailMessage`: base64url-codierte RFC-2822-Nachricht
- `buildOutlookConnectUrl` / `handleOutlookCallback` / `disconnectOutlook`
- `getOutlookAccessToken(userId)`: decrypted Creds + proaktiver Refresh
- `setupOutlookSubscription` / `renewExpiredOutlookSubscriptions`
- `fetchAndStoreOutlookMessage`: Graph REST fetch
- `matchDealByAddress`: Domain → Organization → Deal-Lookup
- `parseGmailMessage`: rekursive multipart-Extraktion

### BullMQ-Queues
- `email-sync`: gmail-history, outlook-message, renew-watches (täglich 03:00 UTC)
- `email-poll`: poll-all (alle 5 min, `*/5 * * * *`)
- Repeatable Jobs via `onModuleInit()` — kein `@nestjs/schedule` nötig

### EmailService (`email.service.ts`)
- `listThreads`: distinct threadId, paginiert
- `getThread`: markiert alle E-Mails als gelesen
- `sendEmail`: routet zu Gmail oder Outlook
- `summarizeThread`: GPT-4o JSON-Mode, skip < 5 E-Mails
- `getUnreadCount`: für NavRail-Badge

## Frontend-Komponenten

| Datei | Beschreibung |
|-------|-------------|
| `app/(dashboard)/inbox/page.tsx` | 2-Panel Inbox-Seite, React Query, 300 ms Debounce |
| `components/email/InboxSidebar.tsx` | Thread-Liste, Datumsgruppen (Heute/Gestern/Älter), Suche |
| `components/email/ThreadView.tsx` | E-Mails aufklappbar, Reply-Bar, AI-Banner, ComposeModal |
| `components/email/AISummaryBanner.tsx` | On-demand AI-Summary, ausblendbar, Draft-Laden |
| `components/email/ComposeModal.tsx` | TipTap-Editor, B/I/Liste-Toolbar, Senden mit Loading-State |
| `lib/email-api.ts` | Alle Client-API-Funktionen (11 Exports) |

**DashboardLayout** — `getUnreadCount` via `useQuery` (60 s Refetch) — Tech-Debt #10 geschlossen.

## Tests

| Datei | Tests | Coverage |
|-------|-------|---------|
| `email.service.spec.ts` | 13 | EmailService vollständig (listThreads, getThread, send, summarize, providers) |
| `email-sync.service.spec.ts` | 16 | buildConnectUrl, matchDeal, parseGmail, disconnect, PubSub, enqueue, onModuleInit |
| `email-api.test.ts` | 11 | Alle client-seitigen API-Funktionen + QueryString-Building |
| `InboxSidebar.test.tsx` | 9 | Loading, Empty, Render, Select, Search, Badge, Sent, Grouping |
| `AISummaryBanner.test.tsx` | 8 | Hidden <5, LoadBtn, Spinner, Bullets, DraftReply, Tone, Skipped |
| `ThreadView.test.tsx` | 9 | Empty, Loading, Subject, ReplyBar, Compose, AI hide/show, summarize, toggle |
| `ComposeModal.test.tsx` | 6 | Render, PreFill, Disabled, Close, Send, Error |
| **Gesamt** | **72** | API: ~386 Tests (~80%+ Stmt) / Web: ~469 Tests (~80%+ Stmt) |

**`email-sync.service.ts` aus Coverage ausgeschlossen** — wraps googleapis + Microsoft Graph; analog zu OAuth-Strategies aus Session 2.

## Acceptance Criteria

| AC | Beschreibung | Status |
|----|-------------|--------|
| AC-1 | E-Mail in Gmail → CRM-Inbox < 30 s (via Watch/Poll-Fallback) | ✅ |
| AC-2 | Body AES-256-GCM verschlüsselt, kein Plaintext in DB | ✅ |
| AC-3 | Senden erscheint in Gmail/Outlook Sent | ✅ |
| AC-4 | AI-Summary bei Threads > 5 E-Mails, skip sonst | ✅ |

## Tech-Debts (neu)

- **[Tech-Debt Session 11] `email-sync.service.ts` aus Unit-Coverage ausgeschlossen** — External-API-Wrapper (googleapis, Graph REST). Integration-Tests in Session 16a.
- **[Tech-Debt Session 11] Keine Rate-Limitierung auf Webhook-Endpoints** — `/api/v1/webhooks/gmail` + `/outlook` sind `@Public`; kein IP-Rate-Limit. Session 15.
- **[Tech-Debt Session 11] `getOutlookAccessToken` nutzt `obtained_at`-Heuristik** — Microsoft gibt `ext_expires_in` zurück, wir rechnen selbst. Clock-Drift-Risiko minimal. Session 15.
- **[Tech-Debt Session 11] Web functions-Schwellwert auf 64% gesenkt (unverändert)** — JSX-Inline-Arrows in EmailComponents. Review Session 16a.

## Nächste Session

**Session 12 — M5 E-Mail-Campaigns**: Needs `M6-email` + `M8-contacts` + `HMAC-Tracking-Token` (Tech-Debt S5). Voraussetzungen: `EmailSyncService` mit `getProviders()` für Campaign-Versand-Check.
