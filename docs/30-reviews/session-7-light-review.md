# Session 7 — Light Review (Tier 2)

**Datum:** 2026-05-12
**Branch:** feature/session-7-activities
**Reviewer:** @reviewer (automated Tier-2)
**Scope:** M7 Aktivitäten + BookingModule (44 Dateien, ~4 476 Insertions)

---

## Ergebnis: PASS MIT WARNS

---

## Findings

### [BLOCKER-1] Public Booking-Endpoint ohne Rate-Limiting

**Datei:** `apps/api/src/modules/booking/booking.controller.ts` (POST `/book/:slug`)

**Problem:** Der public `POST /book/:slug`-Endpoint erfordert keine Authentifizierung (per Design) und trägt keinen `@Throttle`- / `@UseGuards(ThrottlerGuard)`-Decorator. Jede IP kann beliebig viele Buchungen anlegen — Slot-Spam, Denial-of-Slot-Attacks (alle Slots blockieren) und Enumeration existierender Slugs sind trivial möglich. Eine globale ThrottlerGuard-Konfiguration auf App-Ebene fehlt ebenfalls.

**Empfehlung:** `@Throttle({ default: { limit: 5, ttl: 60_000 } })` auf den POST-Handler setzen, `ThrottlerModule` in `AppModule` registrieren (`@nestjs/throttler`).

---

### [BLOCKER-2] `Activity`-Schema ohne `deletedAt` — kein Soft-Delete möglich (DSGVO-Risiko)

**Datei:** `packages/db/prisma/schema.prisma` (model Activity)

**Problem:** Das `Activity`-Modell hat kein `deletedAt DateTime?`-Feld. Die Convention (CLAUDE.md) verlangt `deletedAt: null` in jeder WHERE-Clause — das setzt voraus, das Feld existiert. Ohne Soft-Delete werden Activities hart gelöscht; die AuditLog-FK-Kette bricht, und ein DSGVO-konformes „Right to be Forgotten"-Audit ist nicht möglich.

**Empfehlung:** `deletedAt DateTime?` zu `model Activity` hinzufügen, Migration anlegen, alle Service-Queries auf `where: { ..., deletedAt: null }` anpassen, `remove`-Handler auf Soft-Delete umstellen (`update({ data: { deletedAt: new Date() } })`).

---

### [BLOCKER-3] `BookingConfig`-Schema ohne `deletedAt` — gleiches Problem

**Datei:** `packages/db/prisma/schema.prisma` (model BookingConfig)

**Problem:** Identisch zu BLOCKER-2: das `BookingConfig`-Modell hat kein `deletedAt`-Feld. Da BookingConfig PII enthält (verlinkter User, Verfügbarkeitszeiten), ist DSGVO-konformes Soft-Delete auch hier Pflicht.

**Empfehlung:** `deletedAt DateTime?` in `model BookingConfig` ergänzen, booking.service.ts entsprechend anpassen.

---

### [WARN-1] TOCTOU-Race-Condition bei Slot-Buchung

**Datei:** `apps/api/src/modules/booking/booking.service.ts`

**Problem:** Konfliktprüfung und Buchungsanlage sind keine atomare Transaktion. Zwischen Check und Insert kann eine zweite Anfrage denselben Slot belegen (Time-of-Check-Time-of-Use). Resultat: Doppelbuchungen trotz Konfliktcheck.

**Empfehlung:** `prisma.$transaction(async (tx) => { /* conflict check + create */ })` verwenden.

---

### [WARN-2] IDOR auf Activities — fehlender Ownership-Check

**Datei:** `apps/api/src/modules/activities/activities.service.ts` + `activities.controller.ts`

**Problem:** `findOne(id)` sucht nach `{ id }` ohne `userId`-Filter. Ein authentifizierter User kann Activities anderer User lesen, bearbeiten und löschen (Insecure Direct Object Reference), solange er die UUID kennt.

**Empfehlung:** `userId: currentUserId` in die WHERE-Clause von `findOne`, `update` und `remove` einfügen. Pattern analog zu `create`, das `userId` bereits setzt.

---

### [WARN-3] `guestEmail` / `guestName` ohne Maskierung geloggt

**Datei:** `apps/api/src/modules/booking/booking.service.ts`

**Problem:** Logger-Aufrufe enthalten das Buchungsobjekt mit `guestEmail` und `guestName` (PII, DSGVO Art. 4). CLAUDE.md-Konvention: „Keine PII in Logs (email, name, phone)".

**Empfehlung:** Nur `bookingId`, `slotStart`, `userId` loggen — keine PII-Felder.

---

### [WARN-4] BookingModule komplett ohne Tests

**Datei:** `apps/api/src/modules/booking/` (kein `*.spec.ts` vorhanden)

**Problem:** Slot-Konflikt-Logik, Slug-Lookup, 404-Handling und Antwortformat des einzigen ungeschützten Endpoints im System sind ungetestet. Bereits als Tech-Debt in CLAUDE.md Punkt 23 erfasst.

**Empfehlung:** Mindestens: Happy-Path-Test, 404-Test für unbekannten Slug, Konflikt-Test für belegten Slot. Bis Session 16a als Tech-Debt akzeptabel — aber BLOCKER-1 + WARN-2 erhöhen die Dringlichkeit.

---

### [WARN-5] `activities-api.ts`: fetch-Fehler nicht als HTTP-Status propagiert

**Datei:** `apps/web/lib/activities-api.ts`

**Problem:** `response.ok` wird nicht geprüft. Bei 4xx/5xx gibt `response.json()` den Fehler-Body zurück, der als gültige Antwort behandelt wird. Erst fehlende Felder im UI führen dann zu Laufzeitfehlern.

**Empfehlung:** `if (!response.ok) throw new ApiError(response.status, await response.json())` nach jedem fetch-Aufruf.

---

### [INFO-1] `ActivitiesService`: kein Try/Catch für Prisma-Fehler

**Datei:** `apps/api/src/modules/activities/activities.service.ts`

**Problem:** Alle async-Methoden laufen ohne `try/catch`. Prisma-Fehler (z. B. `P2025 Record not found`) propagieren als unformatierte 500-Antwort.

**Empfehlung:** try/catch mit explizitem `NotFoundException` für `P2025`, Re-throw für unerwartete Fehler.

---

### [INFO-2] `use-activities-socket.ts`: mögliche doppelte Event-Handler bei Reconnect

**Datei:** `apps/web/hooks/use-activities-socket.ts`

**Problem:** Bei socket.io-Reconnect könnten ohne explizites `socket.off(event, handler)` im Cleanup doppelte Listener entstehen.

**Empfehlung:** Funktions-Referenz im Cleanup per `socket.off(eventName, handler)` explizit entfernen.

---

## Zusammenfassung

| Severity | Anzahl |
|----------|--------|
| BLOCKER  | 3      |
| WARN     | 5      |
| INFO     | 2      |

**BLOCKER-Übersicht:**
1. `POST /book/:slug` ohne Rate-Limiting → Slot-Spam / Enumeration
2. `Activity`-Modell ohne `deletedAt` → kein Soft-Delete, DSGVO-Risiko
3. `BookingConfig`-Modell ohne `deletedAt` → kein Soft-Delete, DSGVO-Risiko

## Quality-Gate

| Check | Status |
|-------|--------|
| Lint | PASS |
| Typecheck | PASS |
| API-Tests (239) | PASS — 87.36% Stmt / 80.6% Branch |
| Web-Tests (262) | PASS — 88.76% Stmt / 85% Branch |
| npm audit | Tech-Debt (Next.js CVE — Threshold `critical`, bekannt CLAUDE.md Punkt 2) |

## Merge-Empfehlung

**Nicht mergen** bis die 3 BLOCKER behoben sind. Empfohlene Reihenfolge:

1. Schema-Migration: `deletedAt` zu `Activity` + `BookingConfig` hinzufügen
2. Service-Queries anpassen + Soft-Delete-Pfad implementieren
3. Rate-Limiting auf `POST /book/:slug`

WARNs 1–2 (TOCTOU + IDOR) sollten im gleichen Fix-Branch mitgenommen werden, da sie Security-Relevanz haben.
