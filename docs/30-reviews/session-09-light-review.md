# Session 9 — Light Review (Tier 2)

**Datum:** 2026-05-21
**Branch:** feature/session-9-products
**Reviewer:** @reviewer (Tier 2 automated)
**Scope:** M10 Produktkatalog — 29 Dateien, +2703/-67 Zeilen
**Ergebnis:** CLEAN (0 BLOCKER, 1 MAJOR, 2 MINOR)

---

## Vorab-Verification: Globaler Auth-Guard

`apps/api/src/app.module.ts` registriert `{ provide: APP_GUARD, useClass: JwtAuthGuard }` als globalen Guard. `ProductsController` braucht daher kein eigenes `@UseGuards()`. Vermuteter Security-BLOCKER ist ein **False Positive** — alle Endpunkte sind global geschützt.

---

## Findings

| # | Severity | Datei | Problem |
|---|----------|-------|---------|
| 1 | MINOR | `apps/web/components/deals/DealProductsTab.tsx` | `const currency = products[0]?.product ? 'EUR' : 'EUR'` — beide Branches identisch. Dead code, kein echter Currency-Lookup. |
| 2 | MINOR | `apps/web/components/products/ImportCsvModal.tsx` | CSV-Preview via nativem `split(',')` — Felder mit Kommas in Anführungszeichen werden falsch gesplittet. Server-Import (Papaparse) korrekt; nur die Preview-Tabelle ist irreführend. |
| 3 | MAJOR | `apps/web/app/(dashboard)/products/page.tsx` + `DealProductsTab.tsx` | `deleteMutation` und `removeMutation` haben kein `onError`-Callback. Schlägt ein Delete fehl, erfährt der User keine Rückmeldung. Stille Fehler bei destruktiven Aktionen. |

---

## 1. Offensichtliche Bugs

- `deletedAt: null` in allen `findAll`-, `findOne`-, `update`- und `remove`-Queries vorhanden. Kein Soft-Delete-Bypass.
- `assertCodeUnique` mit `excludeId` bei PATCH korrekt implementiert. Kein False-Conflict auf den eigenen Code.
- `importCsv`: Wenn `parser.abort()` nach dem 5000-Zeilen-Limit ausgelöst wird, resolved das Promise mit dem bisherigen `createdCount` — korrekt, kein Hang.
- Currency-Dead-Code (Finding #1): kein Datenverlust, akzeptabler Placeholder.

## 2. Error-Handling

- API-Exceptions propagieren korrekt via NestJS Exception-Filter (`NotFoundException`, `ConflictException`, `BadRequestException`).
- `importCsv` im Controller wirft `BadRequestException` bei fehlendem File.
- PapaParse `error`-Callback rejected das Promise sauber.
- **Finding #3:** `deleteMutation` / `removeMutation` ohne `onError` — stille Fehler für den User. Empfehlung: `onError: (e) => toast.error(...)` ergänzen, konsistent mit allen anderen Mutations im Projekt.

## 3. Security

- Globaler `APP_GUARD` via `JwtAuthGuard` schützt alle Routen. Kein offener Endpoint.
- MIME-Type des CSV-Uploads wird serverseitig nicht geprüft (nur Dateigröße 20 MB). Akzeptables Risiko: Papaparse führt keinen `eval` aus, Nicht-CSV-Inhalte erzeugen Row-Validierungsfehler. Kein BLOCKER; Multer `fileFilter` wäre sauber.
- Kein `$queryRaw` mit Template-Strings. Kein SQL-Injection-Risiko.
- Keine PII in Logs. Keine hardcodierten Secrets.

## 4. Tests

- `products.service.spec.ts` (250 Zeilen): findAll, findOne, create (incl. Duplikat-Code-Konflikt), update, remove, importCsv (Happy Path + Row-Fehler + 5001-Zeilen-Limit) abgedeckt.
- `products.controller.spec.ts` (73 Zeilen): Delegation + `BadRequestException` bei fehlendem File.
- Grenzfall exakt 5000 Zeilen nicht getestet (nur 5001) — akzeptabel für Tier 2.
- Kein echter Datum-Mock — konsistent mit Session-5-Tech-Debt (#16).
- Kumulativ: 696 Tests, API 86.93% Stmt / 80.62% Branch, Web 88.25% Stmt / 82.41% Branch.

## 5. DSGVO

- Soft-Delete via `deletedAt` durchgängig implementiert. Kein Hard-Delete auf produktivem Pfad.
- `Product`-Stammdaten (name, code, category) sind keine personenbezogenen Daten im DSGVO-Sinne.
- `visibleFor`-Array enthält Rollen, keine personenbezogenen Daten.
- Keine PII in Logs.

---

## Zusammenfassung

**PR ist merge-ready. 0 BLOCKER.**

Der vorab vermutete Security-BLOCKER (fehlender `@UseGuards()` am Controller) ist ein False Positive — der globale `APP_GUARD` schützt alle Endpunkte projektweit.

Das MAJOR-Finding (#3) verhindert keinen Merge, sollte aber als Tech-Debt in CLAUDE.md Punkt #33 aufgenommen werden: `deleteMutation` / `removeMutation` ohne `onError` geben dem User keine Rückmeldung bei fehlgeschlagenen Delete-Operationen.
