---
title: "M5 E-Mail-Campaigns"
tags: [module, m5, campaigns, email-marketing, dsgvo, hmac, bullmq, gpt4o]
status: implemented
session: 12
related: [M6-email, M8-contacts]
last_updated: 2026-05-28
summary: "DSGVO-konformer Campaign-Versand, HMAC-Tracking-Tokens, BullMQ-Batch-Versand, GPT-4o-Betreffzeilen, 4-Schritt-Wizard, Drag-Drop-Editor. 13 Endpoints. Session 12."
---

# M5 E-Mail-Campaigns

## Was dieses Modul tut
DSGVO-konformer E-Mail-Kampagnen-Versand. Pflicht-Opt-in-Check vor jedem Versand (DSGVO_VIOLATION bei Fehler). HMAC-signierte Tracking-Tokens für Open/Click/Unsubscribe. BullMQ Batch-Versand (50/Batch, 1 s Delay). GPT-4o Betreffzeilen-Vorschläge. Bounce-Handling via SendGrid-Webhook.

## Kritische Business-Regeln
1. **DSGVO-Pflicht**: `validateRecipients` vor jedem Versand — `optIn=false` → 400 `DSGVO_VIOLATION`
2. **HMAC-Tracking**: kein UUID — `${campaignId}:${personId}:${action}:${sig16}` — Forging verhindert
3. **Soft-Delete**: `deletedAt: null` IMMER in WHERE-Clause (Campaign)
4. **DOMPurify**: `bodyHtml` IMMER sanitisiert (USE_PROFILES: html)
5. **onDelete: Cascade**: CampaignContact wird gelöscht wenn Campaign oder Person gelöscht
6. **sendCampaign** nur für Campaigns mit `status: DRAFT`

## Datenmodell

**Campaign**: `name`, `subject`, `bodyHtml`, `previewText?`, `status` (DRAFT/SENDING/SENT/...), `scheduledAt?`, `sentAt?`, `senderId`, `totalRecipients`, `openCount`, `clickCount`, `unsubCount`, `bounceCount`

**CampaignContact**: `campaignId`, `personId`, `trackingToken @unique`, `sentAt?`, `openedAt?`, `clickedAt?`, `unsubscribedAt?`, `bouncedAt?`

**Person** (Ergänzung): `optOutAt DateTime?`

**Indizes**: `CampaignContact(campaignId, sentAt)`

## API-Endpoints (13)

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/v1/campaigns` | JWT MANAGER+ |
| GET | `/api/v1/campaigns` | JWT |
| GET | `/api/v1/campaigns/:id` | JWT |
| PATCH | `/api/v1/campaigns/:id` | JWT MANAGER+ |
| DELETE | `/api/v1/campaigns/:id` | JWT MANAGER+ |
| POST | `/api/v1/campaigns/:id/contacts` | JWT MANAGER+ |
| DELETE | `/api/v1/campaigns/:id/contacts/:personId` | JWT MANAGER+ |
| POST | `/api/v1/campaigns/:id/send` | JWT MANAGER+ |
| POST | `/api/v1/campaigns/:id/test-send` | JWT |
| POST | `/api/v1/campaigns/:id/ai-subjects` | JWT |
| GET | `/api/v1/public/track/open/:sig` | @Public |
| GET | `/api/v1/public/track/click/:sig?url=` | @Public |
| GET/POST | `/api/v1/public/unsubscribe/:sig` | @Public |
| POST | `/api/v1/campaigns/webhooks/sendgrid` | @Public |

## BullMQ-Queue
- `campaign-send`: `send-batch` (batchIndex, totalBatches, contactIds, campaignId)
- `CampaignSendProcessor`: injectTracking + MailService stub + sentAt + auto-finalize

## Session: 12 | Modell: sonnet-4-6 | Tests: 62 neu (448 API / 505 Web)
