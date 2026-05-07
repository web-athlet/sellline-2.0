# ADR New

Erstellt ein neues Architectural Decision Record. Verwendung: /adr-new Titel der Entscheidung

---

Erstelle ein neues ADR für: $ARGUMENTS

```bash
# Nächste ADR-Nummer ermitteln
LAST=$(ls docs/40-decisions/[0-9]*.md 2>/dev/null | sort | tail -1 | grep -o '[0-9]\{4\}' | head -1)
NEXT=$(printf "%04d" $((10#${LAST:-0} + 1)))
SLUG=$(echo "$ARGUMENTS" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd 'a-z0-9-')
FILENAME="docs/40-decisions/${NEXT}-${SLUG}.md"
echo "Erstelle: $FILENAME"
```

@doc-keeper erstelle $FILENAME mit diesem Inhalt:

```markdown
---
title: "${NEXT} — $ARGUMENTS"
status: proposed
date: $(date +%Y-%m-%d)
tags: [adr]
summary: "Entscheidung: $ARGUMENTS — Status: proposed"
---

# ADR ${NEXT} — $ARGUMENTS

## Context

_Welches Problem oder welche Situation macht diese Entscheidung notwendig?_

## Entscheidung

_Was wurde entschieden?_

## Begründung

_Warum diese Option? Was wurden als Alternativen erwogen?_

| Option | Pro | Contra |
|--------|-----|--------|
| Gewählt: ... | ... | ... |
| Alternativ: ... | ... | ... |

## Konsequenzen

_Was wird durch diese Entscheidung einfacher, was schwieriger?_
_Welche Sessions sind betroffen?_

## Status

Proposed → **Accepted** / Rejected / Superseded by ADR-XXXX

---
_Erstellt: $(date +%Y-%m-%d) | Letzte Änderung: $(date +%Y-%m-%d)_
```

Dann docs/99-index.md aktualisieren.
