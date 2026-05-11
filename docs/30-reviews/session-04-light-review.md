---
title: "Light Review Session 4 — M8 Kontakte & Organisationen"
session: 4
type: light
status: fixes-required
date: 2026-05-11
blockers: 3
summary: "Light Review Session 4: 3 BLOCKER (findDuplicates DoS, Timeline sentAt null-Sort, Merge notes-Überschreibung)"
---

# Session 4 Light Review — M8 Kontakte & Organisationen

> Reviewer: @reviewer | Tier: 2 (Light) | Datum: 2026-05-11

## Scope

`git diff main..feature/session-4-contacts` — 39 Dateien, 3873 Zeilen.
Module: `ContactsModule` (CRUD, Duplikat-Erkennung, Merge, Timeline), `OrganizationsModule` (CRUD, Tree),
DTOs, Frontend-Komponenten, Migration.

## Findings

| # | Severity | Datei:Zeile | Problem | Vorschlag |
|---|----------|-------------|---------|-----------|
| B1 | BLOCKER | `contacts.service.ts:~L480` | `findDuplicates` kein Limit — O(n²) DoS | `take: 1000` Hard-Cap + HTTP 429 |
| B2 | BLOCKER | `contacts.service.ts:~L620` | `sentAt: null` → `new Date(null)` = Epoch 1970, Timeline-Sort falsch | null-Guard im Sort-Comparator |
| B3 | BLOCKER | `contacts.service.ts:~L340` | Merge überschreibt `notes` des Duplikats + kein Self-Merge-Guard | Append statt Überschreiben, `masterId === duplicateId` Guard |
| W1 | MAJOR | `merge-contacts.dto.ts` | `masterId`/`duplicateId` ohne `@IsUUID('4')` | `@IsUUID('4')` hinzufügen |
| W2 | MAJOR | `organizations.service.ts:~L85` | `buildSubTree` kein null-Guard nach `findFirst` — Race Condition → TypeError 500 | `if (!org) return null;` |
| W3 | MAJOR | `contacts.service.spec.ts` | `findDuplicates` ohne Error-Case-Tests | Mindestens 1 Prisma-Fehler-Szenario |
| W4 | MAJOR | `DuplicateMergePanel.tsx` | 0% Coverage auf destruktiver Merge-UI | Tests für Merge-Button, Loading, Error — Session 16a |
| H1 | MINOR | `organizations.service.ts` | N+1 in `buildSubTree` (exponentielle Queries bei breitem Tree) | CTE oder In-Memory-Traversal — Session 9+ |
| H2 | MINOR | `contacts.controller.ts` | Kein Owner-Check (IDOR) — bekannt bis Session 15 | Session 15 Security-Härtung |
| H3 | MINOR | `query-contacts.dto.ts` | `search` ohne `@MaxLength()` | `@MaxLength(255)` |

---

## BLOCKER-Details

### B1: `findDuplicates` ohne Limit — DoS-Risiko

**Datei:** `apps/api/src/contacts/contacts.service.ts` ~Zeile 480

`prisma.person.findMany({ where: { deletedAt: null } })` hat kein `take`. Bei N Kontakten entstehen
N*(N-1)/2 In-Memory-Fuzzy-Vergleiche. Mit 10.000 Kontakten: ~50 Millionen Vergleiche in einem
synchronen Loop. Endpunkt ist für alle authentifizierten User erreichbar (kein Admin-Gate) — klassischer
Anwendungs-DoS über teuren Endpunkt.

```ts
// FIX:
const persons = await this.prisma.person.findMany({
  where: { deletedAt: null },
  select: { id: true, firstName: true, lastName: true, emails: true },
  take: 1000, // Hard-Cap
});
if (persons.length >= 1000) {
  // Optional: HTTP 429 oder Warnung im Response
}
```

---

### B2: `getTimeline` — `sentAt: null` führt zu Epoch-0-Sort

**Datei:** `apps/api/src/contacts/contacts.service.ts` ~Zeile 620

`Email.sentAt` ist `DateTime?` (nullable) im Prisma-Schema. Der Sort-Comparator:
```ts
const dateB = b._type === 'activity' ? (b.dueDate ?? b.createdAt) : b.sentAt;
return new Date(dateB).getTime() - new Date(dateA).getTime();
```
`new Date(null).getTime()` = `0` (1970-01-01T00:00:00.000Z). Entwurf-Emails mit `sentAt = null`
werden lautlos an das Ende der Timeline sortiert — kein Fehler, keine Warnung, aber falsch angezeigte
Daten in der UI.

```ts
// FIX:
const getDate = (item: typeof timeline[number]): number => {
  if (item._type === 'activity') return new Date(item.dueDate ?? item.createdAt).getTime();
  return item.sentAt ? new Date(item.sentAt).getTime() : Date.now(); // Entwürfe oben
};
return getDate(b) - getDate(a);
```

---

### B3: Merge überschreibt `notes` + kein Self-Merge-Guard

**Datei:** `apps/api/src/contacts/contacts.service.ts` ~Zeile 340

**Problem 1:** Das Duplikat-Kontakt-Update in der `$transaction` setzt `notes: \`merged into ${masterId}\``.
Vorhandene `notes` des Duplikats werden ohne Backup überschrieben und sind nach dem Soft-Delete
unwiederbringlich verloren.

**Problem 2:** Kein Guard für `masterId === duplicateId`. Ein Aufruf mit identischen IDs durchläuft
die Lookup-Checks (beide finden denselben Kontakt), landet in der Transaktion und soft-deleted
den Kontakt — Self-Merge löscht Daten.

```ts
// FIX 1: Self-Merge-Guard (bereits vor den Lookups)
if (masterId === duplicateId) {
  throw new BadRequestException('masterId und duplicateId dürfen nicht identisch sein');
}

// FIX 2: notes als Append (in der $transaction)
const dupWithNotes = await this.prisma.person.findFirst({
  where: { id: duplicateId, deletedAt: null },
  select: { id: true, notes: true },
});
// ...
this.prisma.person.update({
  where: { id: duplicateId },
  data: {
    deletedAt: new Date(),
    notes: [dupWithNotes?.notes, `merged into ${masterId}`].filter(Boolean).join('\n'),
  },
}),
```

---

## Quality-Gate

- Lint: PASS (laut Session-4-Summary)
- Typecheck: PASS (laut Session-4-Summary)
- Unit: PASS (~98% API, 89.44% Web) — aber Error-Cases für `findDuplicates` fehlen
- Integration: — (nicht vorhanden, erwartet ab Session 16a)
- npm audit: — (nicht geprüft)

## Positiv

- `$executeRaw` in `merge()` korrekt als tagged template parametrisiert — kein SQL-Injection-Risiko.
- Partial Unique Index `emails[1] WHERE deletedAt IS NULL` — DSGVO-korrekt, erlaubt Re-Use nach Soft-Delete.
- `deletedAt: null` konsequent in allen Prisma-Queries vorhanden (keine vergessene Filterung).
- `QueryContactsDto` mit `@Max(100)` auf `limit` — verhindert übermäßige Datenabfragen.
- Merge-Transaktion via `$transaction` — FK-Updates und Soft-Delete atomar.
- Kein direktes `fetch()` ohne Auth-Header im Frontend — zentrale `apiFetch`-Utility.

## Entscheid

- [ ] CLEAN — merge freigegeben
- [x] FIXES REQUIRED — 3 BLOCKER vor Merge beheben (B1, B2, B3)
