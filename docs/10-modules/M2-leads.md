---
title: "M2 Leads und Webformulare"
tags: [module, m2, leads, webforms, enrichment, dnd, bullmq]
status: implemented
session: 8
related: [M3-deals.md, M8-contacts.md]
last_updated: 2026-05-21
summary: "FormsModule + LeadsModule + PublicModule vollständig implementiert in Session 8: embeddable Webformulare, DnD FormBuilder, BullMQ lead-enrichment Stub, lead:enriched WS-Event, atomare convert-Transaktion (Person + Deal). AC-011 ✅."
---

# M2 Leads und Webformulare

## Status

**Implementiert in Session 8** — [session-08-summary.md](../20-sessions/session-08-summary.md)

---

## Was dieses Modul tut

Eingehende Leads aus Webformularen, manuellem Eintrag oder zukünftiger KI-Enrichment-Pipeline erfassen, qualifizieren und in CRM-Objekte (Person + Deal) konvertieren.

---

## Prisma-Entities

### Lead (aus Session 1)

Soft-Delete via `deletedAt`. Alle Queries enthalten `deletedAt: null`.

### Form (aus Session 1)

Felddefinitionen als `schemaJson`. Alle `label`/`placeholder` Werte werden via DOMPurify sanitisiert beim Speichern.

---

## API-Endpunkte

### FormsModule (`/api/v1/forms`) — JWT Auth

| Method | Path | Beschreibung |
|--------|------|-------------|
| GET | `/api/v1/forms` | Liste aller Formulare |
| POST | `/api/v1/forms` | Formular erstellen (DOMPurify-Sanitisierung) |
| GET | `/api/v1/forms/:id` | Formular-Detail |
| PUT | `/api/v1/forms/:id` | Formular aktualisieren |
| DELETE | `/api/v1/forms/:id` | Soft-Delete |
| GET | `/api/v1/forms/:id/embed` | Embed-Snippet generieren |

### LeadsModule (`/api/v1/leads`) — JWT Auth

| Method | Path | Beschreibung |
|--------|------|-------------|
| GET | `/api/v1/leads` | Liste (Filter: enrichmentStatus, source, formId) |
| POST | `/api/v1/leads` | Lead manuell erstellen |
| GET | `/api/v1/leads/:id` | Lead-Detail |
| PATCH | `/api/v1/leads/:id` | Lead aktualisieren |
| DELETE | `/api/v1/leads/:id` | Soft-Delete |
| POST | `/api/v1/leads/:id/convert` | Atomare Transaktion: Person + Deal erstellen |
| POST | `/api/v1/leads/:id/enrich` | Erneut in `lead-enrichment` Queue stellen |

### PublicModule — Kein Auth

| Method | Path | Rate-Limit | Beschreibung |
|--------|------|-----------|-------------|
| POST | `/api/v1/public/forms/:id/submit` | 5/min/IP | Öffentlicher Form-Submit |

---

## Frontend

| Route | Beschreibung |
|-------|-------------|
| `/leads` | Lead-Übersicht mit Status-Tabs |
| `/forms` | Formular-Grid mit Karten |
| `/forms/builder` | Neues Formular anlegen |
| `/forms/builder/[id]` | Formular bearbeiten + Embed-Snippet |
| `/f/[id]` | Öffentliches Embed-Formular (kein Auth) |

**Komponenten:** `LeadTable`, `EnrichmentBadge`, `ConvertLeadModal`, `FormBuilder` (DnD 3-Panel, aus Coverage ausgeschlossen)

---

## WebSocket

| Event | Payload | Hook |
|-------|---------|------|
| `lead:enriched` | `LeadEnrichedEvent` | `useLeadsSocket` → invalidiert React Query Cache |

---

## BullMQ

| Queue | Status | Worker |
|-------|--------|--------|
| `lead-enrichment` | Stub — Enqueue funktioniert | Worker → Session 14 |

`LEAD_ENRICHMENT_QUEUE` Konstante in `leads.service.ts` exportiert für Session 14.

---

## Security & Business-Regeln

- DOMPurify auf alle `label`/`placeholder` Felder beim Speichern (XSS-Schutz)
- Rate-Limit 5 Requests/min/IP auf öffentlichem Form-Submit (`@Throttle`)
- `@Public()` Decorator: kein JWT auf `/public/**`
- CORS `Access-Control-Allow-Origin: *` via `@Header()` auf PublicController (volles CORS-Middleware: Session 15)
- Soft-Delete: `deletedAt` Marker; alle Queries enthalten `deletedAt: null`
- `convert` nutzt atomare Prisma-Transaktion (`$transaction`) — Lead + Person + Deal konsistent oder kein Objekt; 409 bei Doppel-Convert

---

## Acceptance Criteria

- [x] AC-011: Embeddable form saves lead via `POST /public/forms/:id/submit`
- [x] DnD Form Builder mit 3 Panels (`@dnd-kit`)
- [x] Enrichment-Status via `lead:enriched` WebSocket Event
- [x] XSS Sanitization via DOMPurify auf Labels/Placeholders
- [x] Rate-Limited Submit (5/min/IP via `@Throttle`)
- [x] Convert-Flow: atomare Transaktion → Person + Deal

---

## Tech-Debt

| ID | Beschreibung | Geplant für |
|----|-------------|-------------|
| TD-27 | FormBuilder aus Web-Coverage ausgeschlossen (DnD nicht unit-testbar) | Session 16a |
| TD-28 | Public Submit CORS nur via `@Header` Override; volles CORS-Middleware | Session 15 |
| TD-29 | Lead Enrichment Worker nur Stub | Session 14 |

## Session: 8 | Modell: claude-sonnet-4-6 | Thinking: think-hard | AC: 6/6
