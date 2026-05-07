---
title: "NextGen CRM — Doc-Übersicht"
tags: [overview, navigation, toc]
status: active
last_updated: 2026-05-07
summary: "Inhaltsverzeichnis und Navigationshilfe für das Second Brain des NextGen CRM."
---

# NextGen CRM — Second Brain

> Dieses `docs/`-Verzeichnis ist das lebende Wissens-System des Projekts.
> Jeder Subagent liest hier nach. @doc-keeper hält alles aktuell.

## Schnell-Navigation

### 🏗 Architektur & Setup
| Datei | Inhalt |
|-------|--------|
| [architecture.md](architecture.md) | System-Diagramm, Datenflüsse, Modul-Übersicht |
| [tech-stack.md](tech-stack.md) | Alle Technologien mit Versionen und Begründungen |
| [glossary.md](glossary.md) | Alle Projektbegriffe definiert |

### 📦 Module (M1–M10)
| Modul | Datei | Status | Kritischer Pfad |
|-------|-------|--------|----------------|
| M1 Pulse-Feed | [M1-pulse-feed.md](../10-modules/M1-pulse-feed.md) | ⬜ | ✓ |
| M2 Leads | [M2-leads.md](../10-modules/M2-leads.md) | ⬜ | — |
| M3 Deals | [M3-deals.md](../10-modules/M3-deals.md) | ⬜ | ✓ |
| M4 Projekte | [M4-projects.md](../10-modules/M4-projects.md) | ⬜ | — |
| M5 Campaigns | [M5-campaigns.md](../10-modules/M5-campaigns.md) | ⬜ | — |
| M6 E-Mail | [M6-email.md](../10-modules/M6-email.md) | ⬜ | ✓ |
| M7 Aktivitäten | [M7-activities.md](../10-modules/M7-activities.md) | ⬜ | — |
| M8 Kontakte | [M8-contacts.md](../10-modules/M8-contacts.md) | ⬜ | ✓ |
| M9 Insights | [M9-insights.md](../10-modules/M9-insights.md) | ⬜ | — |
| M10 Produkte | [M10-products.md](../10-modules/M10-products.md) | ⬜ | — |

### 📋 Sessions (0–16b)
→ [docs/20-sessions/](../20-sessions/) — Session-Summaries mit TLDR

### 🔍 Reviews
→ [docs/30-reviews/](../30-reviews/) — Light + Deep Reviews pro Session

### 🧭 Entscheidungen (ADRs)
→ [docs/40-decisions/](../40-decisions/) — Architectural Decision Records

### 🚀 Runbooks
→ [docs/50-runbooks/](../50-runbooks/) — Operative Playbooks für Production

### 🤖 KI-Prompts
→ [docs/60-prompts/](../60-prompts/) — Wiederverwendbare Prompt-Bausteine

### 🗺 Gesamt-Index
→ [docs/99-index.md](../99-index.md) — Alle Dokumente mit Summaries

---

## Konventionen für dieses Second Brain

**Frontmatter:** Jede .md hat `title`, `tags`, `status`, `last_updated`, `summary`.
Das `summary`-Feld ist das wichtigste — Agents lesen es als Schnell-Filter.

**Status-Werte:**
- Module-Docs: `planned` | `implemented` | `deprecated`
- ADRs: `proposed` | `accepted` | `rejected` | `superseded`
- Sessions: `planned` | `in-progress` | `completed` | `blocked`

**Wer schreibt was:**
- `@doc-keeper`: alles außer 30-reviews/
- `@reviewer`: ausschließlich 30-reviews/
- Builder (Hauptagent): KEINE Docs (nutzt /session-end → @doc-keeper)
