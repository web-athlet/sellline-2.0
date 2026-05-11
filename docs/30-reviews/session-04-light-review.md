---
title: "Light Review Session 4 — M8 Kontakte & Organisationen (Post-Fix)"
session: 4
type: light
status: clean
date: 2026-05-11
blockers: 0
summary: "Post-Fix: alle 3 BLOCKER behoben (take:1000, sentAt-Guard, Self-Merge-Guard+notes-Append). 3 MAJOR als Tech-Debt offen."
---

# Session 4 Light Review — M8 Kontakte & Organisationen

> Reviewer: @reviewer | Tier: 2 (Light) | Datum: 2026-05-11

## Scope

`git diff main..feature/session-4-contacts` — 40 Dateien, 4041 Zeilen.
Module: `ContactsModule` (CRUD, Duplikat-Erkennung, Merge, Timeline), `OrganizationsModule` (CRUD, Tree),
DTOs, Frontend-Komponenten, Migration.

---

## BLOCKER-Verifikation (Post-Fix)

| # | Status | Befund |
|---|--------|--------|
| B1 | ✅ BEHOBEN | `findDuplicates`: `take: 1000` Hard-Cap in Prisma-Query vorhanden — O(n²) Loop begrenzt |
| B2 | ✅ BEHOBEN | `getTimeline`: `getDate()`-Helper mit null-Guard — `item.sentAt ? new Date(...) : Date.now()` — kein `new Date(null)` mehr möglich |
| B3 | ✅ BEHOBEN | `merge()`: Self-Merge-Guard (`masterId === duplicateId` → `BadRequestException`) + notes-Append (`[master.notes, dup.notes].filter(Boolean).join('\n\n')`) korrekt |

---

## Findings-Übersicht

| # | Severity | Datei | Problem | Entscheid |
|---|----------|-------|---------|-----------|
| ~~B1~~ | ~~BLOCKER~~ | ~~contacts.service.ts~~ | ~~findDuplicates kein Limit~~ | ✅ Behoben |
| ~~B2~~ | ~~BLOCKER~~ | ~~contacts.service.ts~~ | ~~sentAt null → Epoch-Sort~~ | ✅ Behoben |
| ~~B3~~ | ~~BLOCKER~~ | ~~contacts.service.ts~~ | ~~Merge überschreibt notes + kein Self-Merge-Guard~~ | ✅ Behoben |
| W1 | MAJOR | `merge-contacts.dto.ts` | `masterId`/`duplicateId` ohne `@IsUUID('4')` — jeder String passiert Validation | Tech-Debt → Session 5 oder 15 |
| W2 | MAJOR | `organizations.service.ts:~L89` | `buildSubTree` kein null-Guard nach `findFirst` — Race Condition → TypeError 500 | Tech-Debt → Session 5 |
| W3 | MAJOR | `contacts.service.spec.ts` | `findDuplicates` ohne Error-Case-Tests + kein Test für Self-Merge-Guard | Tech-Debt → Session 16a |
| W4 | MAJOR | `DuplicateMergePanel.tsx` | 0% Coverage auf destruktiver Merge-UI | Tech-Debt → Session 16a |
| H1 | MINOR | `organizations.service.ts` | N+1 in `buildSubTree` (exponentielle Queries bei breitem Tree) | Session 9+ |
| H2 | MINOR | `contacts.controller.ts` | Kein Owner-Check (IDOR) — bekannt bis Session 15 | Session 15 |
| H3 | MINOR | `query-contacts.dto.ts` | `search` ohne `@MaxLength()` | Session 5 |
| NF1 | MINOR | `contacts.service.ts` | `notes`-Konkatenation ohne Längenbegrenzung (Column unbounded) | Session 15 |
| NF2 | MINOR | `contacts.service.spec.ts` | Kein Test für `take: 1000` Kappen-Verhalten | Session 16a |

---

## MAJOR-Details (Tech-Debt, kein Merge-Blocker)

### W1: `merge-contacts.dto.ts` — fehlender `@IsUUID('4')`

`masterId` und `duplicateId` sind nur mit `@IsNotEmpty()` / `@IsString()` dekoriert.
Jeder beliebige String (z.B. Path-Traversal-Muster oder numerische ID) passiert die Validation
und landet in der Prisma-Abfrage, die dann ein stilles 404 zurückgibt statt einem 400.

```ts
// FIX:
@IsUUID('4')
masterId: string;

@IsUUID('4')
duplicateId: string;
```

---

### W2: `organizations.service.ts` — null-Guard in `buildSubTree`

```ts
const org = await this.prisma.organization.findFirst({ where: { id, deletedAt: null } });
// kein null-Check — org?.children würde TypeError werfen
```

Bei Concurrent Soft-Delete oder staler ID in einem rekursiven Aufruf wirft der Zugriff auf
`org.name` / `{ ...org, children }` einen unbehandelten `TypeError: Cannot read properties of null`.

```ts
// FIX:
if (!org) return null;
```

---

### W3: `contacts.service.spec.ts` — fehlende Error-Cases

Folgende Szenarien fehlen in der Spec:
- `findDuplicates` — Prisma-Fehler (DB unreachable) → 500
- `merge()` mit `masterId === duplicateId` → 400 `BadRequestException`
- `merge()` mit unbekannter `masterId` → 404

---

## Quality-Gate

| Check | Status | Anmerkung |
|-------|--------|-----------|
| Lint | PASS | Laut Session-4-Summary + Fix-Commit |
| Typecheck | PASS | Keine tsc-Fehler durch die Fixes |
| Unit (API) | PASS | ~98% Coverage — Error-Cases für `findDuplicates` und Self-Merge fehlen noch |
| Unit (Web) | PASS | 89.44% Lines |
| Integration | — | Erwartet ab Session 16a |
| npm audit | — | Nicht re-run im Fix-Commit |

---

## Positiv (unverändert gültig)

- `$executeRaw` in `merge()` korrekt als tagged template parametrisiert — kein SQL-Injection-Risiko.
- Partial Unique Index `emails[1] WHERE deletedAt IS NULL` — DSGVO-korrekt, erlaubt Re-Use nach Soft-Delete.
- `deletedAt: null` konsequent in allen Prisma-Queries vorhanden.
- `QueryContactsDto` mit `@Max(100)` auf `limit` — verhindert übermäßige Datenabfragen.
- Merge-Transaktion via `$transaction` — FK-Updates und Soft-Delete atomar.
- Kein direktes `fetch()` ohne Auth-Header im Frontend — zentrale `apiFetch`-Utility.

---

## Entscheid

- [x] CLEAN — **merge freigegeben** (0 BLOCKER)
- [ ] FIXES REQUIRED

**3 MAJOR als Tech-Debt** in CLAUDE.md aufnehmen (W1, W2, W3 → Sessions 5/15/16a).
