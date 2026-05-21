---
title: "M4 Projekte"
tags: [module, m4, projects, tasks, kanban, templates]
status: implemented
session: 10
related: [M3-deals.md]
last_updated: 2026-05-21
summary: "Projekt-Kanban mit Task-Verwaltung, Deal-Verknüpfung, Vorlagen-System, Fortschritts-Tracking. 12 Endpoints. Session 10."
---

# M4 Projekte

## Was dieses Modul tut
Projekt-Kanban mit 5 Status-Spalten (KICKOFF → CLOSING), Task-Verwaltung mit DnD-Reordering, optionaler Deal-Verknüpfung, Template-Instantiierung mit relativeDueDays-Offset und server-seitiger Fortschritts-Berechnung.

## Kritische Business-Regeln
- Soft-Delete: `deletedAt: null` IMMER in WHERE-Clause (Projects + Tasks)
- `doneTasks` / `totalTasks` / `dueDate` werden server-seitig in `mapProject()` berechnet — kein Client-Overhead
- `GET /projects/templates` MUSS vor `GET /projects/:id` deklariert sein (NestJS Route-Shadowing)
- Template-Instantiierung: `relativeDueDays` wird als `now + days * 86_400_000` berechnet (kein date-fns in API)
- `Task.assigneeId` hat FK-Constraint auf `User.id` (ON DELETE SET NULL) seit Migration `20260521120000_task_assignee_fk`
- `toggleDone` setzt `doneAt = new Date()` bei true, `null` bei false
- Task-Erstellung ohne `order`-Angabe: `order = existingTasks.length` (ans Ende anhängen)

## Prisma-Models

```prisma
model Project {
  id         String        @id @default(cuid())
  name       String
  emoji      String?
  status     ProjectStatus @default(KICKOFF)
  dealId     String?
  templateId String?
  tagsJson   String[]
  deletedAt  DateTime?
  createdAt  DateTime      @default(now())
  updatedAt  DateTime      @updatedAt
  deal       Deal?         @relation(fields: [dealId], references: [id])
  template   ProjectTemplate? @relation(fields: [templateId], references: [id])
  tasks      Task[]
}

model Task {
  id          String    @id @default(cuid())
  projectId   String
  title       String
  description String?
  dueDate     DateTime?
  done        Boolean   @default(false)
  doneAt      DateTime?
  assigneeId  String?
  order       Int       @default(0)
  deletedAt   DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  project     Project   @relation(fields: [projectId], references: [id])
  assignee    User?     @relation(fields: [assigneeId], references: [id])
}

model ProjectTemplate {
  id        String   @id @default(cuid())
  name      String
  emoji     String?
  tasksJson Json
  createdAt DateTime @default(now())
  projects  Project[]
}

enum ProjectStatus {
  KICKOFF
  PLANNING
  IMPLEMENTATION
  REVIEW
  CLOSING
}
```

## API-Endpoints

| Method | Path | Auth | Beschreibung |
|--------|------|------|-------------|
| GET | `/api/v1/projects` | JWT | Liste (status/search/dealId/page/limit) |
| POST | `/api/v1/projects` | JWT | Erstellen (name, emoji, dealId, templateId, tags) |
| GET | `/api/v1/projects/templates` | JWT | Alle Templates |
| GET | `/api/v1/projects/:id` | JWT | Detail + Tasks |
| PATCH | `/api/v1/projects/:id` | JWT | Name/Emoji/Tags/DealId |
| DELETE | `/api/v1/projects/:id` | JWT | Soft-delete |
| PATCH | `/api/v1/projects/:id/status` | JWT | Status-Wechsel |
| POST | `/api/v1/projects/:id/from-template` | JWT | Tasks aus Template instantiieren |
| POST | `/api/v1/projects/:id/tasks` | JWT | Task erstellen |
| GET | `/api/v1/tasks` | JWT | Tasks (projectId/assigneeId/done/page/limit) |
| PATCH | `/api/v1/tasks/:id` | JWT | Task updaten |
| DELETE | `/api/v1/tasks/:id` | JWT | Task soft-delete |

## Frontend-Komponenten

| Datei | Beschreibung |
|-------|-------------|
| `components/projects/ProjectKanban.tsx` | DndContext + 5 Spalten, optimistisches Status-Update mit Rollback |
| `components/projects/ProjectKanbanColumn.tsx` | useDroppable, Label + Count + leerer State |
| `components/projects/ProjectCard.tsx` | useSortable, Fortschrittsbalken, dueDate (de-DE), Assignee-Chips |
| `components/projects/CreateProjectModal.tsx` | Name, Emoji-Picker (8 Emojis), Template-Select (konditional) |
| `components/projects/ProjectTaskList.tsx` | DnD-Reordering (arrayMove), Checkbox-Toggle, Inline-Erstellen |
| `app/(dashboard)/projects/page.tsx` | Kanban-Seite mit useQuery + Mutations |
| `app/(dashboard)/projects/[id]/page.tsx` | Detail-Seite (Tabs: tasks / overview) |
| `app/(dashboard)/tasks/page.tsx` | Globale Tasks-Seite (4 Filter: mine/all/today/week) |

## Service-Architektur

```typescript
// Computed fields in mapProject()
const doneTasks = tasks.filter(t => t.done && !t.deletedAt).length;
const totalTasks = tasks.filter(t => !t.deletedAt).length;
const dueDates = tasks.filter(t => t.dueDate && !t.deletedAt).map(t => t.dueDate!);
const dueDate = dueDates.length > 0 ? new Date(Math.max(...dueDates.map(d => d.getTime()))) : null;
```

## Tests

| Datei | Tests | Art |
|-------|-------|-----|
| `projects.service.spec.ts` | 20 | Unit |
| `projects.controller.spec.ts` | 12 | Unit |
| `projects-api.test.ts` | 28 | Unit (Web) |
| `ProjectCard.test.tsx` | 11 | Component |
| `ProjectKanbanColumn.test.tsx` | 5 | Component |
| `ProjectKanban.test.tsx` | 4 | Component |
| `CreateProjectModal.test.tsx` | 9 | Component |
| `ProjectTaskList.test.tsx` | 8 | Component |

## AC-Checklist

- [x] AC-001: Projekte CRUD (create/list/detail/update/delete)
- [x] AC-002: Kanban-Board mit DnD (Status-Spalten)
- [x] AC-003: Tasks CRUD + Toggle + Reorder
- [x] AC-004: Template-Instantiierung mit relativeDueDays

## Tech-Debts

- **#33** `projects/dto/**` aus API-Coverage ausgeschlossen
- **#34** `testTimeout: 30_000` dokumentiert (bcrypt unter Turbo-Last)
- **#35** ProjectKanban ohne order-Feld — DnD ändert nur Status, nicht Reihenfolge innerhalb Spalte
- **#36** Global Tasks Client-seitige Datumsfilterung (Browser-Timezone)

## Session: 10 | Modell: sonnet-4-6 | Dauer: ~2.5h | PR: #13
