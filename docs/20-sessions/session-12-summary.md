---
title: "Session 12 Summary — M5 E-Mail-Campaigns"
tags: [session, summary, m5, campaigns, dsgvo, hmac, bullmq, gpt4o, tracking]
status: completed
session: 12
last_updated: 2026-05-28
summary: "M5 E-Mail-Campaigns vollständig: DSGVO-Validierung, HMAC-Tracking-Tokens, BullMQ-Batch-Versand, GPT-4o-Betreffzeilen, 4-Schritt-Wizard, Drag-Drop-Editor. Tech-Debts D3/D4 erledigt. 62 neue Tests. 7/7 ACs."
---

# Session 12 — M5 E-Mail-Campaigns

## TLDR (5 Punkte)

1. **DSGVO-Pflicht-Validierung** vor jedem Versand: `validateRecipients` prüft `optIn=true` für jeden CampaignContact. Fehlt Opt-in → 400 `DSGVO_VIOLATION` mit PersonId-Liste. Wizard-Step 4 zeigt rotes Alert-Banner + disabled Versand-Button. ADMIN kann Force-Send bestätigen.
2. **HMAC-Tracking-Tokens** (kein UUID): `generateTrackingToken(campaignId, personId, 'open'|'click'|'unsub')` → `${payload}:${sig16}`. Timing-safe HMAC-SHA256 Verifikation. Forged/tampered Tokens → null. Separates `CAMPAIGN_TRACKING_SECRET` (Fallback: `JWT_SECRET`).
3. **BullMQ-Batch-Versand**: `sendCampaign` enqueued Batches à 50 Kontakte mit 1 s Delay zwischen Batches (≈ SendGrid 3000/min). `CampaignSendProcessor` injiziert Merge-Tags (`{{firstName}}`, `{{orgName}}`), Klick-Tracking-Links, Unsub-Footer und Open-Pixel. Nach letztem Batch: auto-finalize zu `SENT`.
4. **GPT-4o Betreffzeilen (AC-025)**: 3 Vorschläge (max 60 Zeichen) mit Reasoning + geschätzter Open-Rate via JSON-Mode. `AiSubjectsPanel` zeigt Suggestions on-demand; Klick übernimmt Subject ins Formular.
5. **Schema-Migrationen (Tech-Debts D3/D4)**: `Person.optOutAt DateTime?` (D3), `Campaign.previewText String?`, `CampaignContact.sentAt DateTime?`, FK `RESTRICT→CASCADE` für CampaignContact→Campaign und CampaignContact→Person (D4).

## Implementierte Endpoints (13)

| Method | Path | Auth | Beschreibung |
|--------|------|------|-------------|
| POST | `/api/v1/campaigns` | JWT MANAGER+ | Erstellen (DOMPurify) |
| GET | `/api/v1/campaigns` | JWT | Liste paginiert (status-Filter) |
| GET | `/api/v1/campaigns/:id` | JWT | Detail + Contacts |
| PATCH | `/api/v1/campaigns/:id` | JWT MANAGER+ | Update (nur DRAFT) |
| DELETE | `/api/v1/campaigns/:id` | JWT MANAGER+ | Soft-Delete |
| POST | `/api/v1/campaigns/:id/contacts` | JWT MANAGER+ | Empfänger hinzufügen (Bulk) |
| DELETE | `/api/v1/campaigns/:id/contacts/:personId` | JWT MANAGER+ | Empfänger entfernen |
| POST | `/api/v1/campaigns/:id/send` | JWT MANAGER+ | DSGVO-valide + BullMQ-Enqueue |
| POST | `/api/v1/campaigns/:id/test-send` | JWT | Test an aktuellen User |
| POST | `/api/v1/campaigns/:id/ai-subjects` | JWT | GPT-4o Betreffzeilen |
| GET | `/api/v1/public/track/open/:sig` | @Public | 1×1 PNG Pixel (openCount++) |
| GET | `/api/v1/public/track/click/:sig` | @Public | Redirect + clickCount++ |
| GET/POST | `/api/v1/public/unsubscribe/:sig` | @Public | Landing Page / opt-out |
| POST | `/api/v1/campaigns/webhooks/sendgrid` | @Public | Hard/Soft-Bounce Handler |

## Schema-Änderungen

```sql
-- Migration: 20260528120000_campaigns_module
ALTER TABLE "Campaign" ADD COLUMN "previewText" TEXT;
ALTER TABLE "Person" ADD COLUMN "optOutAt" TIMESTAMP(3);
ALTER TABLE "CampaignContact" ADD COLUMN "sentAt" TIMESTAMP(3);
CREATE INDEX "CampaignContact_campaignId_sentAt_idx" ON "CampaignContact"("campaignId", "sentAt");
-- FK RESTRICT → CASCADE (Tech-Debt D4)
ALTER TABLE "CampaignContact" DROP CONSTRAINT "CampaignContact_campaignId_fkey";
ALTER TABLE "CampaignContact" DROP CONSTRAINT "CampaignContact_personId_fkey";
ALTER TABLE "CampaignContact" ADD CONSTRAINT "CampaignContact_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignContact" ADD CONSTRAINT "CampaignContact_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

## Neue Env-Variablen

| Variable | Beschreibung |
|----------|-------------|
| `CAMPAIGN_TRACKING_SECRET` | HMAC-Secret für Tracking-Tokens (Fallback: `JWT_SECRET`). Empfehlung: separater 32-Byte-Hex-String. |

## Backend-Architektur

### CampaignsService (`campaigns.service.ts`)
- `generateTrackingToken` / `validateTrackingToken`: HMAC-SHA256, `timingSafeEqual`, 4-part Format `${cid}:${pid}:${action}:${sig16}`
- `create` / `update`: DOMPurify auf `bodyHtml` (USE_PROFILES html)
- `validateRecipients`: prüft `optIn=true` + `deletedAt=null` für alle CampaignContacts → 400 `DSGVO_VIOLATION`
- `sendCampaign`: validate → status SENDING → BullMQ Batches à 50 (1 s delay)
- `injectTracking`: ersetzt `{{firstName}}`/`{{orgName}}`, wrapped Links, injiziert Unsub-Footer + Open-Pixel
- `trackOpen` / `trackClick` / `unsubscribe`: idempotent, Atomic DB + Counter
- `handleSendGridBounce`: hard bounce → optIn=false + optOutAt; soft → bounceCount nur
- `finalizeCampaignIfComplete`: nach letztem Batch → SENT wenn alle sentAt gesetzt

### BullMQ-Queue
- `campaign-send`: `send-batch` Jobs (batchIndex, totalBatches)
- `CampaignSendProcessor`: injectTracking + mailService.sendCampaignEmail + sentAt setzen

### MailService (Erweiterung)
- `sendCampaignEmail(to, subject, bodyHtml)`: Stub-Log (real SendGrid in Production)

## Frontend-Komponenten

| Datei | Beschreibung |
|-------|-------------|
| `app/(dashboard)/campaigns/page.tsx` | Liste mit Status-Tabs (Alle/Entwürfe/Gesendet/Wird gesendet) |
| `app/(dashboard)/campaigns/new/page.tsx` | 4-Schritt-Wizard-Seite |
| `app/(dashboard)/campaigns/[id]/page.tsx` | Detail: Stats, Empfänger-Tabelle, HTML-Preview, Send/Test |
| `components/campaigns/CampaignWizard.tsx` | 4-Schritt-Wizard (Template→Empfänger→Editor→Senden) |
| `components/campaigns/CampaignEmailEditor.tsx` | Drag-Drop-Block-Editor (@dnd-kit: Text/Bild/Button/Divider/Spacer) |
| `components/campaigns/CampaignList.tsx` | Tabelle mit Status-Badge, Stats-Expand, Delete |
| `components/campaigns/CampaignStats.tsx` | 5 Stat-Cards (Empfänger/Öffnungen/Klicks/Unsub/Bounce) |
| `components/campaigns/CampaignStatusBadge.tsx` | Status-Chip (6 Zustände) |
| `components/campaigns/AiSubjectsPanel.tsx` | GPT-4o Suggestions mit Reasoning + Rate |
| `lib/campaigns-api.ts` | 13 API-Funktionen + QueryKeys |

## Tests

| Datei | Tests | Coverage |
|-------|-------|---------|
| `campaigns.service.spec.ts` | 50 | HMAC, CRUD, DSGVO, trackOpen/Click/Unsub, Bounce, injectTracking, finalize |
| `campaigns.controller.spec.ts` | 12 | Alle Controller-Delegates |
| `campaigns-api.test.ts` | 14 | Alle API-Funktionen + QueryString-Building |
| `CampaignList.test.tsx` | 10 | Loading, Empty, Status-Badges, Delete, Stats-Toggle, Link |
| `AiSubjectsPanel.test.tsx` | 8 | Generate, Loading, Suggestions, onSelect, Rates |
| `CampaignStats.test.tsx` | 4 | Labels, Open-Rate-%, 0-Guard |
| **Gesamt (neu)** | **62** | API: 448 Tests (~86%+ Stmt) / Web: 505 Tests (~90%+ Stmt) |

**CampaignEmailEditor + CampaignWizard aus Web-Coverage ausgeschlossen** — @dnd-kit DnD + multi-step Router/Session, analog zu FormBuilder.

## Acceptance Criteria

| AC | Beschreibung | Status |
|----|-------------|--------|
| AC-025 | KI schlägt 3 Betreffzeilen vor (Reasoning + Open-Rate) | ✅ |
| DSGVO-Val | `optIn=false` → 400 DSGVO_VIOLATION | ✅ |
| HMAC | Forged/tampered Token → null | ✅ |
| Unsub | Klick setzt `optIn=false` + `optOutAt` | ✅ |
| Open-Pixel | 1×1 PNG, Cache-Control: no-store | ✅ |
| Bounce | Hard-Bounce optOut, Soft-Bounce Counter | ✅ |
| Batches | 50/Batch × 1 s Delay (≈3000/min) | ✅ |

## Tech-Debts (erledigt)

- **[Done Session 12] Tech-Debt #9 S5** — HMAC-Tracking-Token in `CampaignContact.trackingToken` ✅
- **[Done Session 12] Tech-Debt #9 D3** — `Person.optOutAt` migriert ✅
- **[Done Session 12] Tech-Debt #9 D4** — `CampaignContact` onDelete: Cascade ✅

## Tech-Debts (neu)

- **[Tech-Debt Session 12] MailService ohne echtes SMTP** — `sendCampaignEmail` ist Stub-Log. Real SendGrid/Postmark in Session 15 (Security & DSGVO-Härtung).
- **[Tech-Debt Session 12] CampaignEmailEditor + CampaignWizard ohne Unit-Tests** — @dnd-kit DnD + Router/Session nicht unit-testbar. Session 16a.
- **[Tech-Debt Session 12] Keine Rate-Limitierung auf Tracking-Endpoints** — `GET /public/track/open/:sig` ohne IP-Rate-Limit. Session 15.
- **[Tech-Debt Session 12] Kein CAMPAIGN_TRACKING_SECRET in .env** — Fällt auf JWT_SECRET zurück. Deployment-Checkliste in Session 15.

## Nächste Session

**Session 13 — M9 Insights & Analytics**: braucht Daten aus M5 (Kampagnen-Stats), M3 (Deals), M8 (Kontakte), M6 (E-Mails). Voraussetzungen: Campaign.openCount/clickCount/bounceCount/unsubCount live.
