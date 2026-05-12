---
title: "M7 Aktivitaeten"
tags: [module, m7, activities, calendar, dnd, conflict-detection, booking, bullmq]
status: implemented
session: 7
related: []
last_updated: 2026-05-12
summary: "M7 Aktivitäten implementiert in Session 7: CRUD-API, 7 Zeitfilter, HasLinkedEntityConstraint, BullMQ deal-scoring, Conflict Detection, react-big-calendar+DnD, BookingModule. 14/14 ACs. Branch: feature/session-7-activities."
---

# M7 Aktivitaeten

## Was dieses Modul tut

Activity-Management mit Kalender (react-big-calendar + DnD), 7 Zeitfiltern, Conflict Detection für Meetings,
polymorphe Verknüpfung Deal/Person/Org, BullMQ deal-scoring Queue und Calendly-Clone Buchungsseite.

## Kritische Business-Regeln

- Soft-Delete: `deletedAt` IMMER in WHERE-Clause
- HasLinkedEntityConstraint: mindestens dealId ODER personId ODER orgId Pflicht
- Conflict Detection: `(a.start < b.end) AND (a.end > b.start)` server-seitig + client-seitiger Pre-Check
- BullMQ jobId: `scoring-{dealId}` mit 60s Delay (Debounce) beim markDone
- Nur Assignee, Manager oder Admin darf Aktivität bearbeiten/löschen

## Datenmodell

Migration: `20260512120000_activities_booking`

- `Activity` (seit Session 1 im Schema) — CRUD vollständig
- `User.bookingSlug String? @unique` — öffentliche Booking-URL (neu Session 7)
- `BookingConfig` (neu Session 7): slotDuration, workdayStart, workdayEnd, timezone, activeDays

## API-Endpoints

| Method | Path | Auth | Beschreibung |
|--------|------|------|--------------|
| GET | /api/v1/activities | JWT | Liste (paginiert, 7 Zeitfilter) |
| POST | /api/v1/activities | JWT | Erstellen (HasLinkedEntityConstraint) |
| GET | /api/v1/activities/:id | JWT | Einzelne Aktivität |
| PATCH | /api/v1/activities/:id | JWT | Aktualisieren |
| DELETE | /api/v1/activities/:id | JWT | Soft-Delete |
| PATCH | /api/v1/activities/:id/done | JWT | Als erledigt markieren |
| POST | /api/v1/activities/check-conflicts | JWT | Terminkonflikt prüfen |
| GET | /booking/public/:slug | Public | Buchungsprofil |
| GET | /booking/public/:slug/slots | Public | Verfügbare Slots |
| POST | /booking/public/:slug/book | Public | Termin buchen |

## Session: 7 | Modell: sonnet-4-6 | Thinking: think-hard | Branch: feature/session-7-activities

→ [Session-07-Summary](../20-sessions/session-07-summary.md) | 14/14 ACs | Coverage: API 87.36% / Web 88.76%
