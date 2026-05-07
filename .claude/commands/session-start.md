# Session Start

Startet Session $ARGUMENTS mit minimalem, präzisem Kontext-Load.

---

Du startest Session $ARGUMENTS des NextGen-CRM-Projekts.

## Schritt 1: Minimalen Kontext laden

```bash
# Entry Point (immer)
cat CLAUDE.md

# Vorherige Session Summary (falls N > 0)
PREV=$((  $ARGUMENTS - 1 ))
cat docs/20-sessions/session-$(printf "%02d" $PREV)-summary.md 2>/dev/null \
  || echo "(Keine Vor-Session oder Summary fehlt noch)"

# Session-spezifische Modul-Docs laden
# Mapping Session → Module:
# 0: kein Modul-Doc (Scaffolding)
# 1: alle Module-Frontmatter (nur summary lesen, nicht Volltext)
# 2: kein Modul-Doc (Auth ist cross-cutting)
# 3: kein Modul-Doc (Navigation/Shell)
# 4: M8-contacts
# 5: M3-deals + M8-contacts (Abhängigkeit)
# 6: M1-pulse-feed + M3-deals (Abhängigkeit)
# 7: M7-activities + M3-deals + M8-contacts
# 8: M2-leads + M3-deals
# 9: M10-products + M3-deals
# 10: M4-projects + M3-deals
# 11: M6-email + M8-contacts + M3-deals
# 12: M5-campaigns + M6-email + M8-contacts
# 13: M9-insights (alle Module als Datenquellen)
# 14: M2-leads + M3-deals + M6-email (KI-Inputs)
# 15: alle Security-relevanten Docs
# 16a: alle Module (Testing)
# 16b: kein Modul-Doc (PWA/CICD)
```

## Schritt 2: Kontext-Check ausgeben

Antworte mit GENAU diesem Format — nicht mehr:

```
## Session $ARGUMENTS — Bereit

**Projekt-Stand:**
- Abgeschlossene Sessions: [Liste aus CLAUDE.md]
- Aktive BLOCKER: [aus CLAUDE.md, oder "keine"]
- Letzte Schema-Änderung: [aus Vor-Session-TLDR]

**Geladener Kontext:**
- CLAUDE.md: ✅ (~{X} Tokens)
- Vor-Session-Summary: ✅/❌ (~{Y} Tokens)
- Modul-Docs: {Name} ✅ (~{Z} Tokens)
- Geschätzte Context-Nutzung: ~{Gesamt} Tokens

**Voraussetzungen für Session $ARGUMENTS:**
- [Voraussetzung 1]: ✅ erfüllt / ❌ FEHLT
- [Voraussetzung 2]: ✅ erfüllt / ❌ FEHLT

**Bereit für Session-Opener-Prompt.**
Token-Budget noch verfügbar: ~{Rest} Tokens
```

## Schritt 3: Auf Session-Opener warten

Coden NICHT. Warten auf den Implementierungs-Prompt des Users.
