---
title: "Light Review Session 10 — M4 Projekte"
session: 10
type: light
status: clean
date: 2026-05-21
blockers: 0
summary: "Light Review Session 10: CLEAN — 0 BLOCKER, 3 WARN"
---

# Light Review Session 10 — M4 Projekte

**Status:** CLEAN — 0 BLOCKER, 3 WARN

## Scope

git diff: 33 Dateien, +3065 / -6 Zeilen  
Module: `ProjectsModule` (API) · `projects-api.ts` (Web) · Kanban + TaskList + Modals (Web)  
Migration: `20260521120000_task_assignee_fk` — `Task.assigneeId` FK tightened

## Quality-Gate

| Check | Ergebnis |
|-------|----------|
| Typecheck API | PASS |
| Typecheck Web | PASS |
| Lint API | PASS |
| Lint Web | PASS |
| Unit-Tests | PASS |
| Coverage ≥ 80% | PASS |
| Integration | PASS |
| npm audit | PASS |
| Keine Secrets | PASS |
| API-Build | PASS |
| Web-Build | PASS |

## Findings

| # | Severity | Datei:Zeile | Problem | Vorschlag |
|---|----------|-------------|---------|-----------|
| 1 | WARN | `dto/create-project.dto.ts:20` | `tags?: string[]` fehlen `@IsArray()` + `@IsString({ each: true })` — `UpdateProjectDto` hat diese Decorators, `CreateProjectDto` nicht. Beliebiger Wert wird ungefiltert in `tagsJson` gespeichert. | `@IsOptional() @IsArray() @IsString({ each: true }) tags?: string[]` — konsistent mit Update-DTO. |
| 2 | WARN | `projects.controller.ts:57` | `@Body('templateId') templateId: string` umgeht die ValidationPipe. Fehlt `templateId`, liefert Service `NotFoundException: Template undefined not found` statt 400 Bad Request. | Eigenes DTO `{ templateId: string }` mit `@IsString() @IsNotEmpty()` einführen. |
| 3 | WARN | `projects/[id]/page.tsx:50-53` | `reorderTaskMutation` hat kein `onSuccess`-Invalidierungs-Handler. Nach Drag-and-Drop-Reorder bleibt der React-Query-Cache stale bis zum nächsten manuellen Refetch. | `onSuccess: () => queryClient.invalidateQueries({ queryKey: projectsKeys.detail(id) })` ergänzen — analog den anderen Mutationen in derselben Datei. |

## Positive Befunde

- **Globaler JWT-Guard korrekt**: `APP_GUARD → JwtAuthGuard` schützt alle Endpunkte — kein lokaler `@UseGuards()` nötig.
- **Soft-Delete konsequent**: `deletedAt: null` in allen WHERE-Clauses (`project.findFirst`, `project.findMany`, `task.findFirst` via `project: { deletedAt: null }`).
- **`doneAt`-Togglelogik korrekt**: `updateTask` setzt/löscht `doneAt` genau dann, wenn `done` von Wert wechselt — kein Überschreiben bei idempotenten Updates.
- **Tech-Debt #5 aus CLAUDE.md abgeräumt**: `Task.assigneeId` jetzt vollständige Prisma-Relation mit FK-Constraint und `ON DELETE SET NULL`.
- **Testabdeckung gut**: 20 Service-Tests · 12 Controller-Tests · 18 API-Client-Tests · 5 Komponenten-Testdateien.
- **Route-Shadowing richtig gelöst**: `GET /projects/templates` vor `GET /projects/:id` — Kommentar dokumentiert den Grund.

## Tech-Debt-Kandidaten (kein BLOCKER)

- `tasks/page.tsx` und `projects/page.tsx` haben keine Unit-Tests (page-level, üblich) — Session 16a.
- `reorderTaskMutation` (WARN #3) — einfacher Fix, empfehle vor Merge.
- `CreateProjectDto.tags`-Validierung (WARN #1) — einfacher Fix, empfehle vor Merge.

## Empfehlung

**WARN #1 und #3 sind Einzeiler-Fixes — vor Merge erledigen.**  
WARN #2 (unvalidiertes `templateId`) kann als Tech-Debt Session 15 aufgenommen werden.  
Kein BLOCKER. PR kann nach Einzeiler-Korrekturen gemergt werden.
