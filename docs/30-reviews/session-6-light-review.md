---
title: "Light Review Session 6 — M1 Pulse-Feed"
session: 6
type: light
status: clean
date: 2026-05-12
blockers: 0
summary: "Light Review Session 6: CLEAN — 0 BLOCKER, 2 LOW, 1 TECH-DEBT"
---

# Light Review Session 6 — M1 Pulse-Feed

**Status:** CLEAN — 0 BLOCKER  
**Branch:** `feature/session-6-pulse`  
**Reviewer:** Tier-2 Light (Sonnet)

## Scope

`git diff main..HEAD` — 35 Dateien, +2520 / -35 Zeilen  
Neue Module: `PulseFeedModule`, `RedisModule`, 5 Pulse-Komponenten, 1 Socket-Hook, 1 API-Client

---

## 1. Offensichtliche Bugs

| # | Severity | Datei:Zeile | Problem | Vorschlag |
|---|----------|-------------|---------|-----------|
| B1 | LOW | `FeedItem.tsx:43` | `setDismissed(true)` → `return null` lässt den Virtualizer-Slot bestehen (visueller Gap bis zur nächsten Invalidierung) | Kein Handlungsbedarf: `onSettled` ruft `invalidateQueries` auf, Gap verschwindet nach Server-Sync. Dokumentiert. |
| B2 | LOW | `pulse/page.tsx:54` | `mergedItems` hardcodet `20` als Page-Size in Slice-Logik — weicht ggf. vom `limit`-Param ab | Konstante `FEED_LIMIT = 20` extrahieren und in `getPulseFeed` und Slice teilen. Non-blocking weil limit derzeit nicht per UI änderbar. |

---

## 2. Error-Handling

**PASS.** Alle drei Endpunkte werfen korrekte HTTP-Exceptions:
- `completeActivity`: `NotFoundException` (Activity fehlt), `ForbiddenException` (falscher Assignee), idempotent bei `done: true`. ✅
- `getFeed`/`getCounts`: `BadRequestException` für ungültige Datums-Strings via `parseDate`. ✅
- `RedisService`: try/catch auf allen Operationen, Fallback auf `null`/`void` mit Logger.warn — kein unhandled rejection. ✅
- Frontend: `onSettled` invalidiert immer (pessimistisch korrekt), kein Error-Toast aber kein BLOCKER. ✅

**TECH-DEBT:** `getCounts` im Controller nimmt `date: string | undefined` ohne DTO-Validation — Fehler wird erst in `parseDate` im Service geworfen. Konsistenter wäre ein `QueryPulseCountsDto`. Akzeptabel für diese Session.

---

## 3. Security-Basics

**PASS.**

| Check | Ergebnis |
|-------|---------|
| Auth (JWT) | `APP_GUARD: JwtAuthGuard` global — alle Pulse-Feed-Routen geschützt. ✅ |
| IDOR `completeActivity` | `activity.assigneeId !== user.id` → ForbiddenException. Ownership korrekt geprüft. ✅ |
| CSRF | N/A — Bearer-Auth mitigiert CSRF automatisch. ✅ |
| Input-Validation | `QueryPulseFeedDto` mit class-validator (`@IsISO8601`, `@IsEnum`, `@IsInt`, `@Min`, `@Max`). ✅ |
| XSS | `subject`, `dealTitle`, `dealOwnerName` als Text-Nodes gerendert, kein `dangerouslySetInnerHTML`. ✅ |
| PII in Logs | Redis-Service loggt Key-Pattern und Fehlermeldungen, keine Email/Name/Tel. ✅ |
| Redis `KEYS` | Dokumentiert als Tech-Debt (#22 in CLAUDE.md) — akzeptabel für Low-Traffic-CRM. ✅ |
| URL-Injection | `getPulseCounts` interpoliert `date` in URL — Wert stammt aus eigenem State (ISO-String), kein Angriffspfad. ✅ |

---

## 4. Tests

**PASS.**

| Datei | Tests | Coverage-Aspekte |
|-------|-------|------------------|
| `pulse-feed.service.spec.ts` | 13 | Cache-Hit/-Miss, alle 3 Tabs, BadRequest, NotFound, Forbidden, Idempotenz, WS-Emit |
| `pulse-feed.controller.spec.ts` | 5 | Alle 3 Endpunkte, Error-Propagation |
| `calculatePriorityScore` (unit) | 4 | Caps, Zero-Case, Urgent-Threshold, Sort-Korrektheit |
| `pulse-api.test.ts` | 8 | formatActivityType, formatCurrency, formatDueDate, todayISO |
| `use-pulse-socket.test.ts` | 6 | Listener-Registration, Tab-Match, Tab-Mismatch, null-Tab, Unmount-Cleanup, No-Token |
| `DayNav.test.tsx` | — | Im Diff enthalten ✅ |
| `FeedItem.test.tsx` | — | Im Diff enthalten ✅ |
| `TabBar.test.tsx` | — | Im Diff enthalten ✅ |
| `InfoBanner.test.tsx` | — | Im Diff enthalten ✅ |

Nicht abgedeckt: `pulse/page.tsx` (Next.js Page — typischerweise E2E, kein BLOCKER), `FeedList.tsx` (kein separater Test — LOW, acceptable für diese Session).

---

## 5. DSGVO

**PASS.**

- Redis-Cache-Keys: `pulse:{userId}:{date}:{tab}:{page}` — UUID, keine PII. ✅
- `localStorage`: nur `pulse.banner_dismissed = '1'` gespeichert — keine PII. ✅
- `deletedAt: null` in allen Prisma-Queries (`Activity`, `Deal`, `Stage`) konsequent eingehalten. ✅
- Kein Personendaten-Logging in Service oder Redis. ✅

---

## Quality-Gate

| Check | Status |
|-------|--------|
| Typecheck | PASS (strict: true) |
| Lint | PASS |
| Unit Tests | PASS — 13+5+4+8+6 neue Tests |
| DSGVO | PASS |
| npm audit | PASS (bestehender Next-14 CVE-Threshold auf `critical`, bereits als Tech-Debt #2 dokumentiert) |

---

## Fazit

**0 BLOCKER. PR kann gemergt werden.**

2 LOW-Findings (FeedItem-Dismiss-Gap, hardcodiertes Limit=20) und 1 Tech-Debt (getCounts ohne DTO) sind für eine spätere Session oder den PR-Kommentar geeignet. Alle bestehenden CLAUDE.md-Tech-Debts korrekt gepflegt.
