# NextGen CRM — Claude Code Workflow

## Was ist das hier?

Dieses Verzeichnis enthaelt den vollstaendigen Workflow-Setup fuer die Entwicklung
des NextGen CRM mit Claude Code. Kopiere alles in dein Projekt-Root.

## Struktur

```
nextgen-crm/               ← dein Projekt-Root
├── CLAUDE.md              ← Entry Point fuer alle Claude-Sessions (max 200 Zeilen)
├── WORKFLOW_README.md     ← diese Datei (kannst du loeschen nach Setup)
├── .claude/
│   ├── agents/            ← 4 Subagenten
│   │   ├── architect.md   ← Planungs-Agent (kein Code)
│   │   ├── reviewer.md    ← Review-Agent (read-only)
│   │   ├── tester.md      ← Test-Agent (nur Test-Dateien)
│   │   └── doc-keeper.md  ← Docs-Agent (nur docs/ + CLAUDE.md)
│   └── commands/          ← 6 Slash-Commands
│       ├── session-start.md   ← /session-start N
│       ├── session-end.md     ← /session-end N
│       ├── review-light.md    ← /review-light
│       ├── review-deep.md     ← /review-deep
│       ├── adr-new.md         ← /adr-new Titel
│       └── module.md          ← /module M3
├── docs/                  ← Second Brain (Wissens-System)
│   ├── 00-overview/       ← Architektur, Tech-Stack, Glossar
│   ├── 10-modules/        ← 1 Datei pro Modul (M1-M10)
│   ├── 20-sessions/       ← Session-Summaries (von @doc-keeper)
│   ├── 30-reviews/        ← Light + Deep Reviews (von @reviewer)
│   ├── 40-decisions/      ← ADRs (4 Initial-ADRs enthalten)
│   ├── 50-runbooks/       ← Operative Playbooks
│   ├── 60-prompts/        ← Wiederverwendbare KI-Prompts
│   └── 99-index.md        ← Auto-generierter Gesamt-Index
└── scripts/
    ├── quality-gate.sh    ← Pflicht vor jedem session-end
    └── update-index.sh    ← Aktualisiert 99-index.md

```

## Ablauf pro Session (Kurzversion)

```
1. Terminal 1: /session-start N
2. Terminal 1: [Session-Opener-Prompt aus DevSessions_Prompts_v3.md einfuegen]
3. Terminal 1: [Klaerungsfragen beantworten]
4. Terminal 1: [Implementierungs-Prompt einfuegen — laeuft 30-90 min]
5. Terminal 1: /session-end N           ← Quality-Gate + Docs + Commit
6. Terminal 2: /clear → /review-light  ← NEUE Session, isolierter Context
   (kritische Sessions: /review-deep statt /review-light)
7. Merge PR wenn Review clean
```

## Einmalige Einrichtung

```bash
# 1. Claude Code aktualisieren
claude update  # braucht v2.1.111+

# 2. Standard-Modell setzen
# In Claude Code eingeben:
# /model opusplan
# /effort high

# 3. Quality-Gate ausfuehrbar machen
chmod +x scripts/quality-gate.sh scripts/update-index.sh

# 4. Index initial generieren
bash scripts/update-index.sh

# 5. Begleit-Dokument bereithalten
# NextGen_CRM_DevSessions_Prompts_v3.md neben diesem Projekt oeffnen
# (z.B. in zweitem VSCode-Fenster oder Browser-Tab)
```

## Token-Effizienz auf einen Blick

| Mechanismus | Token-Einsparung |
|------------|-----------------|
| Frontmatter-Summary statt Volltext-Scan | ~85% bei Doc-Lookups |
| Session-TLDR (5 Zeilen) statt vollem Summary | ~75% bei History-Loads |
| Subagent-Isolation (Reviewer = neuer Context) | ~60% im Review-Step |
| Lazy Module-Loading via /module | ~90% bei Modul-Abfragen |
| CLAUDE.md Hard-Limit 200 Zeilen | ~70% vs "alles in CLAUDE.md" |
| ADRs statt wiederholter Diskussionen | ~100% bei Entscheidungs-Loops |

## Versionierung

Workflow-Version: 1.0 — Mai 2026
Kompatibel mit: Claude Code >= v2.1.111, Opus 4.7, Sonnet 4.6
