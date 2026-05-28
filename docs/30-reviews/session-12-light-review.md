# Session 12 — Light Review (Tier 2)

**Datum:** 2026-05-28
**Branch:** feature/session-12-campaigns
**Reviewer:** @reviewer (Tier 2 / Sonnet) — findings verified against actual code
**Scope:** M5 E-Mail-Campaigns — 36 Dateien, 3741 Insertions

## Ergebnis: PASS MIT 1 WARNING

**BLOCKER: 0 | WARN: 1 | OK: 9**

---

## BLOCKER (müssen vor Merge behoben werden)

Keine.

---

## WARNINGS (Tech-Debt, kein Merge-Hindernis)

**W1 — BullMQ-Jobs ohne `attempts`/`backoff`-Konfiguration**
`apps/api/src/modules/campaigns/campaigns.service.ts:311` — `sendQueue.add(...)` setzt nur `removeOnComplete`/`removeOnFail`, aber keine `attempts`- und `backoff`-Optionen. Fehlgeschlagene Jobs werden damit nicht automatisch retried. Kein sofortiger Datenverlust (MailService ist noch ein Stub), aber kritisch sobald Session 15 echtes SMTP einbindet.

Vorschlag:
```ts
{ attempts: 3, backoff: { type: 'exponential', delay: 5000 }, ... }
```

Bereits als Tech-Debt #41 erfasst.

---

## OK / Positive Findings

**Sicherheit — HMAC-signierte Tokens korrekt implementiert:**
`validateTrackingToken()` (`:90`) nutzt `timingSafeEqual` mit try/catch-Wrapper (`:103-107`). Buffer-Längen-Mismatches werden abgefangen und als `null` zurückgegeben — kein Crash-Pfad auf Tracking-Endpoints.

**Sicherheit — Open-Redirect geschlossen:**
`campaign-tracking.controller.ts` — `trackClick` gibt nur dann `{ url, statusCode: 302 }` zurück, wenn `trackClick(token, url)` einen validen Ziel-URL liefert. Ungültige Tokens führen zu `BadRequestException(400)`, kein unkonditionaler Redirect. Fix in `bf0988e` verifiziert.

**DSGVO — optIn-Guard doppelt gesichert:**
`campaigns.service.ts:215` prüft `optIn === true && optOutAt === null` vor Versand. `campaign-send.processor.ts` prüft nochmals bei der Zustellung (Double-Check-Pattern). Beide Guards durch Tests abgedeckt.

**DSGVO — optOut atomar:**
`Person.optOutAt` wird in `$transaction` zusammen mit `CampaignContact.unsubscribedAt` und `Campaign.unsubCount` gesetzt. Kein partieller Zustand möglich.

**PII — maskEmail() konsequent eingesetzt:**
`mail.service.ts` nutzt `maskEmail()` in allen Log-Aufrufen einschließlich `sendCampaignEmail`. Keine rohen E-Mail-Adressen in Logs.

**Validierung — Class-Validator DTOs + globaler ValidationPipe:**
Alle vier DTOs (`create-campaign.dto.ts`, `update-campaign.dto.ts`, `add-contacts.dto.ts`, `query-campaigns.dto.ts`) tragen class-validator-Dekoratoren. `whitelist: true` via globalem Pipe.

**Status-Guard auf `update`:**
`campaigns.service.ts:179` — `if (campaign.status !== CampaignStatus.DRAFT)` verhindert Bearbeitung gesendeter/geplanter Campaigns.

**Migration korrekt:**
`20260528120000_campaigns_module/migration.sql` enthält nur `ALTER TABLE`-Statements (neue Spalten + Index + Cascade). Keine Enum-Duplikate, kein ungültiges SQL.

**deletedAt-Guards durchgängig:**
Alle Prisma-Queries in Service und Processor enthalten `deletedAt: null`. Kein Soft-Delete-Bypass.

**Tests vorhanden:**
`campaigns.service.spec.ts` (CRUD, optIn-Filter, HMAC-Token-Format, trackOpen/trackClick/unsubscribe, Division-by-Zero in stats) und `campaigns.controller.spec.ts` bieten gute Happy-Path- und Error-Case-Abdeckung.

---

## Fazit

Der Branch erfüllt alle 7 ACs und kritischen Sicherheits-/DSGVO-Anforderungen. Der einzige technische Verbesserungsbedarf (BullMQ-Retry-Config) ist kein Merge-Blocker und bereits als Tech-Debt #41 geplant. **PR kann gemergt werden.**
