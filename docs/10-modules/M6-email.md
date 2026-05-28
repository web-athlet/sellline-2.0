---
title: "M6 E-Mail-Sync"
tags: [module, m6, email, gmail, outlook, encryption, webhook, bullmq, gpt4o]
status: implemented
session: 11
related: [M3-deals, M8-contacts, M5-campaigns]
last_updated: 2026-05-22
summary: "Gmail + Outlook OAuth2, AES-256-GCM Body-Verschlüsselung, BullMQ Watch/Poll, GPT-4o Thread-Summary, Inbox-UI. 14 Endpoints. Session 11."
---

# M6 E-Mail-Sync

## Was dieses Modul tut
Bidirektionale E-Mail-Synchronisation mit Gmail (Watch API + GCP PubSub) und Outlook (Microsoft Graph Subscriptions). Alle E-Mail-Bodies AES-256-GCM-verschlüsselt. GPT-4o Thread-Summary für Threads > 5 E-Mails. Inbox-UI mit 2-Panel-Layout und TipTap-Compose-Modal.

## Kritische Business-Regeln
- `Email.bodyEncrypted` — KEIN Plaintext in DB; `bodyPreview` max 200 Zeichen
- Soft-Delete: `deletedAt: null` IMMER in WHERE-Clause
- `Email.userId` → `User` ON DELETE CASCADE
- State-Tokens für OAuth-CSRF: HMAC-SHA256, 10 min TTL
- `@Public()` auf Webhook-Controllern — kein JWT, aber GCP JWT-Verifikation auf Gmail-Webhook
- Deal-Matching: Absender-Domain → `Organization.domain` → offener Deal (ownerId = userId)
- AI-Summary: skip wenn < 5 E-Mails im Thread

## Datenmodell
**Email**: `gmailMessageId?`, `outlookMessageId?`, `threadId`, `fromAddress`, `toAddresses`, `cc`, `bcc`, `subject`, `bodyEncrypted`, `bodyPreview`, `isRead`, `isSent`, `sentAt`, `userId`, `dealId?`, `deletedAt`

**User** (Ergänzungen): `gmailTokenEncrypted?`, `gmailHistoryId?`, `gmailWatchExpiresAt?`, `outlookTokenEncrypted?`, `outlookSubscriptionId?`, `outlookSubscriptionExpiresAt?`

**Indizes**: `Email(userId, deletedAt)`, `User(gmailWatchExpiresAt)`

## API-Endpoints (14)

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/email/threads` | JWT |
| GET | `/api/v1/email/threads/:id` | JWT |
| GET | `/api/v1/email/threads/:id/summary` | JWT |
| GET | `/api/v1/email/count` | JWT |
| POST | `/api/v1/email/send` | JWT |
| GET | `/api/v1/email/providers` | JWT |
| GET | `/api/v1/email/gmail/connect-url` | JWT |
| GET | `/api/v1/email/gmail/callback` | JWT |
| DELETE | `/api/v1/email/gmail/disconnect` | JWT |
| GET | `/api/v1/email/outlook/connect-url` | JWT |
| GET | `/api/v1/email/outlook/callback` | JWT |
| DELETE | `/api/v1/email/outlook/disconnect` | JWT |
| POST | `/api/v1/webhooks/gmail` | @Public (PubSub JWT) |
| POST | `/api/v1/webhooks/outlook` | @Public |

## BullMQ-Queues
- `email-sync`: gmail-history, outlook-message, renew-watches (03:00 UTC täglich)
- `email-poll`: poll-all (*/5 * * * * — Fallback für Nutzer ohne aktive Watch)

## Session: 11 | Modell: sonnet-4-6 | Tests: 29 API + 43 Web
