---
title: "M3 — Deals / Pipeline"
tags: [module, kritischer-pfad, m3, deals, kanban, pipeline, dnd]
status: planned
session: 5
related: [M1-pulse-feed, M7-activities, M8-contacts, M10-products]
ac: [AC-002, AC-003, AC-004, AC-005]
last_updated: 2026-05-07
summary: "Kanban-Board mit @dnd-kit DnD, 6 Stages, Pipeline-Value server-seitig, Rot-Indikator, Ghosting-Flag."
---

# M3 — Deals / Pipeline (Kritischer Pfad P0)

## Was dieses Modul tut
Herzstuck des CRM. Kanban-Board mit Drag-and-Drop zwischen 6 konfigurierbaren Stages.
Pipeline-Value server-seitig berechnet. Rot-Indikatoren fuer inaktive Deals.
Zentraler Ausgangspunkt fuer Daily Sales Work.

## Kritische Business-Regeln (IMMER beachten)

1. **Pipeline-Value ist server-seitig** — Client darf nie selbst rechnen (Trust Boundary).
   PATCH /api/deals/:id berechnet und gibt neuen Value zurueck.
2. **Optimistic UI** — Stage-Wechsel sofort im UI, dann API-Call.
   Bei Fehler: Rollback via React Query `onError`.
3. **Rot-Indikator** — Deal ohne Activity seit N Tagen (per Pipeline konfigurierbar).
   N Tage = `rot_indicator: true`.
4. **DnD-Reaktion** — max 16ms (1 Frame bei 60fps) — @dnd-kit pflicht.
5. **Ghosting** — separater Agent, setzt `isGhosted: true` nach 14 Tagen.
   Deals in Stage "Abschluss" sind NICHT ghostable.
6. **Soft-Delete** — `deletedAt` IMMER in WHERE-Clause.

## Datenmodell

```prisma
model Deal {
  id             String    @id @default(uuid())
  title          String
  value          Decimal   @db.Decimal(15, 2)
  currency       String    @default("EUR")
  stageId        String
  pipelineId     String
  ownerId        String
  personId       String?
  companyId      String?
  probability    Int       @default(0)
  rotIndicator   Boolean   @default(false)
  isGhosted      Boolean   @default(false)
  ghostedAt      DateTime?
  lastResponseAt DateTime?
  deletedAt      DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  stage     Stage      @relation(...)
  pipeline  Pipeline   @relation(...)
  owner     User       @relation(...)
  person    Person?    @relation(...)
  company   Company?   @relation(...)
  activities Activity[]
  products  DealProduct[]
}

model Pipeline {
  id               String   @id @default(uuid())
  name             String
  rotThresholdDays Int      @default(7)
  stages           Stage[]
  deals            Deal[]
}

model Stage {
  id       String  @id @default(uuid())
  name     String
  order    Int
  color    String
  pipelineId String
  pipeline Pipeline @relation(...)
  deals    Deal[]
}
```

## Standard-Stages

| # | Name | Farbe | Trigger |
|---|------|-------|---------|
| 1 | Qualifiziert | Neutral | Manuell / Lead-Konvertierung |
| 2 | Demo geplant | Blau | Activity "Meeting" |
| 3 | Demo abgeschlossen | Tuerkis | Meeting erledigt |
| 4 | Angebot abgegeben | Orange | Manuell |
| 5 | Verhandlungen | Gelb | Manuell |
| 6 | Vertrag unterschrieben | Gruen | Deal als gewonnen |

## API-Endpoints

| Method | Route | Beschreibung |
|--------|-------|--------------|
| GET | /api/deals | Paginiert, filter[stage], filter[owner] |
| GET | /api/deals/kanban | Nach Stage gruppiert |
| POST | /api/deals | Erstellen |
| PATCH | /api/deals/:id | Stage-Wechsel, Value-Update (server-side!) |
| DELETE | /api/deals/:id | Soft-Delete |

## Akzeptanzkriterien

- [ ] AC-002: Kanban zeigt alle Deals korrekt nach Stage
- [ ] AC-003: DnD < 16ms, Optimistic UI mit Rollback
- [ ] AC-004: Pipeline-Value aktualisiert nach Stage-Wechsel
- [ ] AC-005: Rot-Indikator nach konfigurierten Tagen

## Session: 5 | Modell: opus-4-7 | Thinking: ultrathink | Dauer: ~5h
