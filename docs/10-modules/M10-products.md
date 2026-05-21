---
title: "M10 Produktkatalog"
tags: [module, m10,products,catalog,pricing]
status: implemented
session: 9
related: []
last_updated: 2026-05-21
summary: "M10 vollständig in Session 9: CRUD /api/v1/products, CSV-Streaming-Import (Papaparse), DealProductsTab mit computeLineTotal + Deal-Wert-Auto-Update (AC-009)."
---

# M10 Produktkatalog

**Implementiert in Session 9** → [session-09-summary.md](../20-sessions/session-09-summary.md)

## Was dieses Modul tut
Produktkatalog mit Preisen, Steuern, Währungen, Deal-Zuweisung mit Menge und Rabatt, Rechnungs-Frequenz, CSV-Import. AC-009: Deal-Wert wird bei Produkt-Zuweisung automatisch aktualisiert.

## Kritische Business-Regeln
- Soft-Delete: `deletedAt` IMMER in WHERE-Clause
- `code` muss unique sein (wenn gesetzt); `assertCodeUnique` in ProductsService
- CSV-Import: max 5000 Zeilen; Papaparse step/pause/resume für <100 MB RAM
- `recomputeDealValue` in DealsService aggregiert `DealProduct.total` → `Deal.value`

## Datenmodell
`Product` und `DealProduct` — seit Session 1 im Prisma-Schema.
Referenz: `packages/db/prisma/schema.prisma`

## API-Endpoints

| Method | Path | Beschreibung |
|--------|------|--------------|
| GET | `/api/v1/products` | Liste, Pagination, `?search`, `?category` |
| POST | `/api/v1/products` | Produkt anlegen |
| PATCH | `/api/v1/products/:id` | Produkt aktualisieren |
| DELETE | `/api/v1/products/:id` | Soft-Delete |
| POST | `/api/v1/products/import` | CSV-Streaming-Import (multipart) |
| POST | `/api/v1/deals/:id/products` | Produkt einem Deal zuweisen |
| GET | `/api/v1/deals/:id/products` | Produkte eines Deals |
| DELETE | `/api/v1/deals/:id/products/:dpId` | Zuweisung entfernen |

## Session: 9 | Modell: sonnet-4-6 | Thinking: think | Dauer: ~2.5h
