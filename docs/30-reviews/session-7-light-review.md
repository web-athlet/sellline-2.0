# Session 7 — Light Review (Tier 2)

**Datum:** 2026-05-12 (Initial) / 2026-05-13 (Post-Fix Re-Review)
**Branch:** feature/session-7-activities
**Reviewer:** @reviewer (automated Tier-2)
**Scope:** M7 Aktivitäten + BookingModule (48 Dateien, ~5 091 Insertions)

---

## Ergebnis: ✅ PASS — MERGE FREIGEGEBEN

Alle 3 BLOCKERs und alle sicherheitsrelevanten WARNs (W-1–W-4) wurden in
`fix(session-7): aed02fd` behoben. Re-Review bestätigt korrekte Umsetzung.

---

## Findings (Initial-Review 2026-05-12)

### [BLOCKER-1] ~~Public Booking-Endpoint ohne Rate-Limiting~~ ✅ BEHOBEN

**Datei:** `apps/api/src/modules/booking/booking.controller.ts`

**Problem:** `POST /public/:slug/book` ohne `@Throttle`-Decorator — Slot-Spam / Enumeration.

**Fix (aed02fd):** `@Throttle({ default: { limit: 5, ttl: 60_000 } })` auf den Handler gesetzt.
GET-Slots-Endpoint erhielt zusätzlich `{ limit: 30, ttl: 60_000 }`. Verifiziert in aktuellem Code.

---

### [BLOCKER-2] ~~`Activity`-Schema ohne `deletedAt`~~ ✅ FALSE POSITIVE

**Datei:** `packages/db/prisma/schema.prisma` (model Activity)

**Problem:** War ein False Positive — `deletedAt DateTime?` + `@@index([deletedAt])` waren bereits
im Prisma-Schema vorhanden (Zeile 18/27). Alle Service-Queries nutzten `deletedAt: null`. Kein Fix nötig.

---

### [BLOCKER-3] ~~`BookingConfig`-Schema ohne `deletedAt`~~ ✅ BEHOBEN

**Datei:** `packages/db/prisma/schema.prisma` (model BookingConfig)

**Fix (aed02fd):** `deletedAt DateTime?` + `@@index([deletedAt])` ergänzt.
Migration `20260512130000_booking_config_deleted_at` angelegt.
Alle `booking.service.ts`-Queries auf `findFirst({ where: { ..., deletedAt: null } })` angepasst.

---

### [WARN-1] ~~TOCTOU-Race-Condition bei Slot-Buchung~~ ✅ BEHOBEN

**Datei:** `apps/api/src/modules/booking/booking.service.ts`

**Fix (aed02fd):** `createBooking` in `prisma.$transaction(async (tx) => { ... })` eingebettet.
Konfliktcheck und `activity.create` laufen atomar. Verifiziert in aktuellem Code (Zeile 163).

---

### [WARN-2] ~~IDOR auf Activities — fehlender Ownership-Check~~ ✅ BEHOBEN

**Datei:** `apps/api/src/modules/activities/activities.service.ts`

**Fix (aed02fd):** `findOne` prüft nun via `canView = assigneeId === user.id || ADMIN || MANAGER`.
Konsistent mit `assertEditable`-Pattern für alle Mutations. Wirft `ForbiddenException` bei Verstoß.

---

### [WARN-3] ~~`guestEmail` / `guestName` ohne Maskierung geloggt~~ ✅ BEHOBEN

**Datei:** `apps/api/src/modules/booking/booking.service.ts`

**Fix (aed02fd):** `Logger` hinzugefügt. Log-Statement: `{ msg: 'booking.created', activityId, userId }`.
Keine PII (guestName, guestEmail) im Log. DSGVO-konform.

---

### [WARN-4] ~~BookingModule komplett ohne Tests~~ ✅ BEHOBEN

**Datei:** `apps/api/src/modules/booking/`

**Fix (aed02fd):** `booking.service.spec.ts` (22 Tests) und `booking.controller.spec.ts` neu hinzugefügt.
Abdeckung: Happy-Path, 404 (unbekannter Slug), Doppelbuchungs-Konflikt, Slot-Generierung, generateSlug.

---

### [WARN-5] `activities-api.ts` fetch-Fehler ohne HTTP-Status — ✅ KEIN PROBLEM

**Datei:** `apps/web/lib/activities-api.ts` → `apps/web/lib/api-client.ts`

**Analyse:** `activities-api.ts` delegiert alle HTTP-Calls an `apiFetch` in `api-client.ts`.
`apiFetch` prüft `res.ok` und wirft `ApiError(status, body)` bei 4xx/5xx (Zeile 34–39 in `api-client.ts`).
WARN war ein False Positive — Fehler werden korrekt propagiert.

---

### [INFO-1] `ActivitiesService`: kein Try/Catch für Prisma-Fehler — OFFEN

**Datei:** `apps/api/src/modules/activities/activities.service.ts`

**Status:** Nicht behoben — akzeptabel für Tier-2. NestJS GlobalExceptionFilter fängt unbehandelte
Exceptions auf; `P2025`-Fehler landen als 500 statt 404. Tech-Debt für Session 16a.

---

### [INFO-2] `use-activities-socket.ts`: doppelte Handler bei Reconnect — OFFEN

**Datei:** `apps/web/hooks/use-activities-socket.ts`

**Status:** Nicht behoben — akzeptabel für Tier-2. `socket.off(event)` ohne Handler-Referenz entfernt
alle Listener dieses Events; bei Reconnect werden neue registriert. Kein aktives Duplikations-Risiko
mit aktuellem single-mount-Pattern. Tech-Debt für Session 16a.

---

## Zusammenfassung

| Severity | Initial | Nach Fix |
|----------|---------|----------|
| BLOCKER  | 3       | 0 ✅     |
| WARN     | 5       | 0 ✅     |
| INFO     | 2       | 2 (offen, akzeptabel) |

## Quality-Gate (nach Fix-Commit aed02fd)

| Check | Status |
|-------|--------|
| Lint | ✅ PASS |
| Typecheck | ✅ PASS |
| API-Tests | ✅ PASS — 270 Tests (87%+ Stmt / 80%+ Branch) |
| Web-Tests | ✅ PASS — 262 Tests (88%+ Stmt / 85%+ Branch) |
| npm audit | Tech-Debt (Next.js CVE — Threshold `critical`, bekannt CLAUDE.md Punkt 2) |

## Merge-Empfehlung

**✅ Freigegeben zum Merge.** Alle BLOCKERs behoben. Alle sicherheitsrelevanten WARNs behoben.
Offene INFOs sind Tech-Debt auf Session-16a-Niveau — kein Merge-Hindernis.

Offene Tech-Debts aus dieser Session für CLAUDE.md:
- INFO-1: Prisma P2025 → NotFoundException-Mapping (Session 16a)
- INFO-2: Socket-Handler-Referenz im Cleanup (Session 16a)
