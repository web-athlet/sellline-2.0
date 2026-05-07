---
title: "M8 — Kontakte (Persons & Companies)"
tags: [module, kritischer-pfad, m8, contacts, persons, companies, fuzzy-search]
status: planned
session: 4
related: [M3-deals, M7-activities, M6-email, M5-campaigns]
ac: [AC-008, AC-019]
last_updated: 2026-05-07
summary: "Personen und Firmen mit Soft-Delete, Duplikat-Erkennung via fast-fuzzy, Unique-Constraint (email, deletedAt)."
---

# M8 — Kontakte (Kritischer Pfad P0)

## Was dieses Modul tut
Verwaltung von Personen und Firmen. Basis-Entitaet fuer Deals, Activities, E-Mails.
Duplikat-Erkennung via fast-fuzzy. Import via CSV (Streaming-Modus).

## Kritische Business-Regeln

1. **Unique-Constraint:** `(email, deletedAt)` — NICHT nur `email`.
   Erlaubt gleiche E-Mail nach Hard-Delete zu re-registrieren.
2. **Fuzzy-Suche:** `fast-fuzzy` Library — Threshold 0.85 fuer Duplikat-Alert.
3. **CSV-Import Streaming:** Papaparse im Streaming-Modus (nicht alles in Memory).
4. **Soft-Delete:** `deletedAt` IMMER in WHERE. Person mit `deletedAt != null` ist fuer den User unsichtbar.
5. **opt_in:** Boolean — Pflicht fuer Campaign-Versand. Default: false.

## Datenmodell

```prisma
model Person {
  id        String    @id @default(uuid())
  firstName String
  lastName  String
  email     String[]  // Array - mehrere E-Mails moeglich
  phone     String[]
  orgId     String?
  optIn     Boolean   @default(false)
  avatarUrl String?
  deletedAt DateTime?
  createdAt DateTime  @default(now())
  org       Company?  @relation(...)
  deals     Deal[]
  activities Activity[]
  @@unique([email, deletedAt])  // KRITISCH: nicht nur email!
}

model Company {
  id            String    @id @default(uuid())
  name          String
  domain        String?
  website       String?
  industry      String?
  employeeCount Int?
  revenue       Decimal?
  enrichedAt    DateTime?
  deletedAt     DateTime?
  persons       Person[]
  deals         Deal[]
}
```

## API-Endpoints

| Method | Route | Beschreibung |
|--------|-------|--------------|
| GET | /api/contacts/persons | 8 Spalten, sortierbar, paginiert |
| GET | /api/contacts/persons/:id | Detail mit Relations |
| POST | /api/contacts/persons | Erstellen + Duplikat-Check |
| PATCH | /api/contacts/persons/:id | Update |
| DELETE | /api/contacts/persons/:id | Soft-Delete |
| POST | /api/contacts/import | CSV Streaming-Import |

## Akzeptanzkriterien

- [ ] AC-008: Liste zeigt 8 Spalten, sortierbar nach allen
- [ ] AC-019: Duplikat-Alert bei aehnlicher E-Mail (fast-fuzzy >= 0.85)

## Session: 4 | Modell: sonnet-4-6 | Thinking: think-hard | Dauer: ~3h
