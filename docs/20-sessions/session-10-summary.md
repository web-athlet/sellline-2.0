---
title: "Session 10 Summary — M4 Projekte"
tags: [session, summary, m4, projects, tasks]
status: completed
session: 10
last_updated: 2026-05-21
summary: "M4 Projekte vollständig: ProjectsModule + TasksModule (12 Endpoints), Kanban-Board mit DnD, Detail-Seite, globale Tasks-Seite, Template-Instantiierung, Task.assigneeId FK-Migration (Tech-Debt #5 erledigt)."
---

# Session 10 — M4 Projekte

## TLDR (5 Punkte)
1. **ProjectsModule + TasksModule** vollständig: 12 REST-Endpoints, soft-delete, `doneTasks`/`totalTasks`/`dueDate` server-seitig berechnet
2. **Task.assigneeId FK** migriert (`20260521120000_task_assignee_fk`) — Tech-Debt #5 erledigt
3. **Kanban-Board** mit @dnd-kit DnD (Status-Wechsel), optimistisches Update + Snapshot-Rollback (exaktes Pattern aus Session 5)
4. **Template-Instantiierung**: `POST /projects/:id/from-template` erzeugt Tasks mit relativeDueDays-Offset ohne date-fns (inline Date-Arithmetik)
5. **Globale Tasks-Seite** `/tasks` mit 4 Filtern (mine/all/today/week), Client-seitige Datumsfilterung

## Implementierte Endpoints

| Method | Path | Beschreibung |
|--------|------|-------------|
| GET | `/api/v1/projects` | Liste mit Status/Search/DealId-Filter, Pagination |
| POST | `/api/v1/projects` | Projekt erstellen (optional templateId) |
| GET | `/api/v1/projects/templates` | Alle Templates (vor `:id`-Route!) |
| GET | `/api/v1/projects/:id` | Detail mit Tasks |
| PATCH | `/api/v1/projects/:id` | Name/Emoji/Tags/DealId updaten |
| DELETE | `/api/v1/projects/:id` | Soft-delete |
| PATCH | `/api/v1/projects/:id/status` | Status-Wechsel |
| POST | `/api/v1/projects/:id/from-template` | Tasks aus Template instantiieren |
| POST | `/api/v1/projects/:id/tasks` | Task erstellen |
| GET | `/api/v1/tasks` | Tasks mit projectId/assigneeId/done-Filter |
| PATCH | `/api/v1/tasks/:id` | Task updaten (toggleDone setzt doneAt) |
| DELETE | `/api/v1/tasks/:id` | Task soft-delete |

## Schema-Änderungen

### Migration: `20260521120000_task_assignee_fk`
```sql
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey"
  FOREIGN KEY ("assigneeId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
```

### Prisma-Model User (ergänzt)
```prisma
assignedTasks Task[]
```

### Seed-Ergänzungen
- "SaaS-Onboarding" Template (4 Tasks, relativeDueDays 3/7/14/21)
- "Custom Integration" Template (6 Tasks, relativeDueDays 1/3/7/14/21/30)

## Neue Dateien

**API:**
- `apps/api/src/modules/projects/projects.service.ts`
- `apps/api/src/modules/projects/projects.controller.ts`
- `apps/api/src/modules/projects/tasks.controller.ts`
- `apps/api/src/modules/projects/projects.module.ts`
- `apps/api/src/modules/projects/dto/` (7 DTOs)
- `apps/api/src/modules/projects/projects.service.spec.ts` (20 Tests)
- `apps/api/src/modules/projects/projects.controller.spec.ts` (12 Tests)

**Web:**
- `apps/web/lib/projects-api.ts` + `projects-api.test.ts` (28 Tests)
- `apps/web/components/projects/ProjectCard.tsx` + `.test.tsx` (11 Tests)
- `apps/web/components/projects/ProjectKanbanColumn.tsx` + `.test.tsx` (5 Tests)
- `apps/web/components/projects/ProjectKanban.tsx` + `.test.tsx` (4 Tests)
- `apps/web/components/projects/CreateProjectModal.tsx` + `.test.tsx` (9 Tests)
- `apps/web/components/projects/ProjectTaskList.tsx` + `.test.tsx` (8 Tests)
- `apps/web/app/(dashboard)/projects/page.tsx` (Kanban-Seite)
- `apps/web/app/(dashboard)/projects/[id]/page.tsx` (Detail-Seite)
- `apps/web/app/(dashboard)/tasks/page.tsx` (Globale Tasks-Seite)

## AC-Status

| AC | Beschreibung | Status |
|----|-------------|--------|
| AC-001 | Projekte CRUD (create/list/detail/update/delete) | ✅ |
| AC-002 | Kanban-Board mit DnD (Status-Spalten) | ✅ |
| AC-003 | Tasks CRUD + Toggle + Reorder | ✅ |
| AC-004 | Template-Instantiierung mit relativeDueDays | ✅ |

## Test-Coverage nach Session

| Paket | Tests | Stmt | Branch |
|-------|-------|------|--------|
| API (gesamt) | ~357 | ~87% | ~81% |
| Web (gesamt) | ~426 | ~88% | ~83% |
| **Gesamt** | **~783** | — | — |

## Behobene Fehler / Fixes während Session

1. **date-fns nicht verfügbar in API** → inline Date-Arithmetik (`now.getTime() + days * 86_400_000`)
2. **buildQs TypeScript-Fehler** → Union-Typ + `as Record<string, unknown>` Cast
3. **beforeEach VitestUtils-Return** → expliziter Block `{ vi.resetAllMocks(); }`
4. **ESLint unused `_tasks`** → umbenannt zu `_omit` + eslint-disable-Kommentar
5. **Prettier-Formatierung** → 9 Dateien nachformatiert
6. **Auth-Tests Timeout** → `testTimeout: 30_000` in vitest.config.ts (bcrypt cost-12 unter Turbo-Last)
7. **CreateProjectModal `getByText('Standard')`** → `getByRole('option', { name: /Standard/ })` (Option enthält Emoji-Prefix)
8. **Route-Shadowing** → `GET templates` vor `GET :id` deklariert

## Tech-Debts (neu in Session 10)

- **#33** `projects/dto/**` aus API-Coverage ausgeschlossen — class-validator DTOs ohne testbares Verhalten
- **#34** `testTimeout: 30_000` in vitest.config.ts — bcrypt cost-12 unter paralleler Turbo-Last dokumentiert
- **#35** ProjectKanban ohne order-Feld — DnD ändert nur Status, keine Reihenfolge innerhalb Spalte. Geplant Session 16a
- **#36** Global Tasks `/tasks` Client-seitige Datumsfilterung nutzt Browser-Timezone. Serverseitige Filterung geplant Session 16a

## Session 11 Voraussetzungen (M6 E-Mail-Sync)

- `Email.userId` FK-Migration (analog zu Task.assigneeId aus Session 10)
- EmailModule mit Gmail historyId-Sync + Outlook Graph
- AES-256-GCM Verschlüsselung für E-Mail-Bodies
- KI Thread-Summary (GPT-4o, kein E-Mail-Body an OpenAI — DSGVO)
- Smart-Reply Suggestions
- Inbox-Count Badge für NavRail (Tech-Debt #10)
