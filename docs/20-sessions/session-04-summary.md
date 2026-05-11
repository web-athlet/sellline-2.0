---
title: "Session 4 — M8 Kontakte & Organisationen"
tags: [session, contacts, organizations, m8, crud, duplicates]
status: implemented
last_updated: 2026-05-11
summary: "M8 vollständig: Contacts/Orgs CRUD, Duplikat-Erkennung+Merge, Org-Hierarchie, 159 API-Tests + 99 Web-Tests."
---

# Session 4 — M8 Kontakte & Organisationen

## TLDR

1. `ContactsModule` + `OrganizationsModule` vollständig implementiert: CRUD, Timeline, Duplikat-Erkennung (fast-fuzzy, Threshold 0.85), Merge (Activities + Deals + CampaignContacts via raw SQL), Org-Hierarchie-Tree bis Tiefe 5.
2. Frontend: `/contacts` Liste (8 Spalten, sortierbar, Pagination, Bulk-Delete, CSV-Export), `/contacts/[id]` Detail (6 Tabs), `/contacts/duplicates` mit Side-by-Side Merge-Panel.
3. DB-Migration `20260510120000_contacts_active_email_index` — Partial Unique Index auf `Person.emails[1]` WHERE `deleted_at IS NULL` verhindert aktive E-Mail-Duplikate.
4. 159 API-Tests (~98% Coverage), 99 Web-Tests (89.44% Lines) — alle Thresholds grün; `DuplicateMergePanel` 0% Coverage (geplant Session 16a).
5. Session 5 (M3 Deals) kann starten: `GET /api/v1/contacts` + `GET /api/v1/organizations` für Participant-Autocomplete und Deal-Org-Link bereit.

---

## Backend

**ContactsModule** (`apps/api/src/modules/contacts/`)

| Endpoint | Beschreibung |
|----------|-------------|
| `GET /api/v1/contacts` | Liste, paginated, sortierbar: name/firstName/lastName/org/deals/createdAt |
| `POST /api/v1/contacts` | Anlegen (Zod-validiert, email-Duplikat-Check) |
| `GET /api/v1/contacts/:id` | Detail mit Org, Deals, Activities |
| `PATCH /api/v1/contacts/:id` | Update (Partial) |
| `DELETE /api/v1/contacts/:id` | Soft-Delete |
| `GET /api/v1/contacts/:id/timeline` | Activities + Emails aggregiert, chronologisch |
| `GET /api/v1/contacts/duplicates` | Duplikat-Paare mit Score |
| `POST /api/v1/contacts/merge` | Merge: `{ masterId, duplicateId }` |

**OrganizationsModule** (`apps/api/src/modules/organizations/`)

| Endpoint | Beschreibung |
|----------|-------------|
| `GET /api/v1/organizations` | Liste, paginated, sortierbar |
| `POST /api/v1/organizations` | Anlegen mit domain-Unique-Check |
| `GET /api/v1/organizations/:id` | Detail mit Children + Counts |
| `PATCH /api/v1/organizations/:id` | Update mit domain-Collision-Guard |
| `DELETE /api/v1/organizations/:id` | Soft-Delete |
| `GET /api/v1/organizations/:id/tree` | Rekursiver Sub-Tree (max. Tiefe 5) |
| `GET /api/v1/organizations/:id/persons` | Persons der Org, paginated |
| `GET /api/v1/organizations/:id/deals` | Deals der Org, paginated |

**Duplikat-Erkennung:**
- Library: `fast-fuzzy` (explizit per Playbook Session 4 vorgegeben)
- Score = `emailScore * 0.6 + nameScore * 0.4` — nur wenn beide Seiten E-Mails haben, sonst rein Name-Score
- Merge überträgt: Activities (`updateMany`), CampaignContacts (`updateMany`), Deal-Participants (raw SQL auf `_DealParticipants`-Join-Table)
- Duplicate erhält `notes: "merged into {masterId}"` + `deletedAt` (Audit-Trail)

---

## Frontend

**Seiten:**
- `/contacts` — `ContactsTable` (8 Spalten, sortierbar), `ContactFilters` (Debounced-Search, Seiten-Größe), `Pagination`, Bulk-Delete/-Export-CSV
- `/contacts/[id]` — Header (Avatar, Name, Kontakt-Actions), 6 Tabs (Übersicht, Deals, Aktivitäten, E-Mails, Dateien, Timeline)
- `/contacts/duplicates` — `DuplicateMergePanel` Side-by-Side, Master-Radio, Merge-Button

**Neue Komponenten** (`apps/web/components/contacts/`):
`ContactsTable`, `ContactFilters`, `Pagination`, `OrgTree` (expand/collapse, rekursiv), `DuplicateMergePanel`

**API-Client:** `apps/web/lib/contacts-api.ts` — 13 Funktionen für Contacts + Organizations

---

## Schema-Änderungen

Keine neuen Prisma-Models (`Person` + `Organization` bereits aus Session 1).

**Neue Migration:**
- `20260510120000_contacts_active_email_index`
- `CREATE UNIQUE INDEX persons_active_email_unique ON persons ((emails[1])) WHERE deleted_at IS NULL`

---

## Neue Env-Variablen

Keine.

---

## Test-Coverage

| Scope | Tests | Lines | Branches |
|-------|-------|-------|---------|
| API (gesamt) | 159 in 15 Files | ~98% | ~98% |
| Web (gesamt) | 99 in 10 Files | 89.44% | 89.18% |

---

## AC-Status (5/5)

- [x] AC-008: Kontakte-Liste zeigt alle 8 Spalten, sortierbar
- [x] AC-019: Duplikat-Erkennung findet ähnliche Kontakte (`/contacts/duplicates`)
- [x] Partial Unique Constraint verhindert aktive E-Mail-Duplikate
- [x] Merge überträgt alle Deals + Activities + CampaignContacts verlustfrei
- [x] Org-Tree rendert 3+ Ebenen korrekt

---

## Tech-Debt (neu aus Session 4)

| ID | Beschreibung | Geplant |
|----|-------------|---------|
| TD-S4-01 | `DuplicateMergePanel.tsx` 0% Test-Coverage | Session 16a |
| TD-S4-02 | Detail-Tabs Deals/Activities/Files/Emails zeigen Placeholder | Sessions 5, 7, 11 |
| TD-S4-03 | "Neuer Kontakt"-Button löst `alert()` aus — Modal verschoben | Session 5 |

---

## Nächste Session (Session 5 — M3 Deals, kritischer Pfad)

**Voraussetzungen erfüllt:**
- `GET /api/v1/contacts` für Participant-Autocomplete
- `GET /api/v1/organizations` für Deal-Org-Link
- `ContactsModule` auf `main` (via PR #6)

---

## Branch & PR

- **Branch:** `feature/session-4-contacts`
- **PR:** [#6](https://github.com/web-athlet/sellline-2.0/pull/6)
- **Commit:** `feat(session-4): M8 Kontakte & Organisationen — CRUD, Duplikat-Erkennung, Merge, Org-Hierarchie`
- **Migration:** `20260510120000_contacts_active_email_index`
