# Review Deep

Tier-3 Deep-Review für kritische Sessions (0,1,2,5,11,14,15). Nutzt Opus 4.7.
Starte IMMER in neuer Session mit /clear davor.

---

Führe einen vollständigen Tier-3 Deep-Review durch.

## Model-Override

```
/model claude-opus-4-7
/effort high
```

## KRITISCH: Kontext-Isolation

Dieser Review läuft in einer NEUEN Session. Der Builder-Kontext ist nicht vorhanden.
Das ist Absicht — unvoreingenommener Blick.

## Kontext laden

```bash
cat CLAUDE.md

# Vollständiger Diff
git diff main..HEAD

# Session-Summary (falls schon erstellt)
LATEST_SESSION=$(ls docs/20-sessions/session-*-summary.md 2>/dev/null | sort | tail -1)
cat "$LATEST_SESSION" 2>/dev/null || echo "Noch keine Summary"

# Security-relevante ADRs
cat docs/40-decisions/0003-csrf-double-submit-cookie.md
cat docs/40-decisions/0001-pgvector-vs-pinecone.md

# Modul-Doc(s) — aus Diff ableiten
```

## Review durchführen

think harder

@reviewer — Tier 3 Deep Review:

Führe den vollständigen Deep-Review durch mit allen Dimensionen:
- Security (OWASP Top 10)
- DSGVO-Vollständigkeit
- Performance (N+1, Memory-Leaks, Indexe)
- Architektur-Konsistenz
- Test-Coverage
- Error-Handling
- Alles aus Tier 2

Schreibe das Ergebnis nach docs/30-reviews/session-{N}-deep-review.md.

## Nach dem Review

```bash
cat docs/30-reviews/*deep*.md | tail -30

BLOCKERS=$(grep -c "BLOCKER" docs/30-reviews/*deep*.md 2>/dev/null || echo 0)
echo ""
echo "=== DEEP REVIEW ERGEBNIS ==="
echo "BLOCKER: $BLOCKERS"

if [ "$BLOCKERS" -gt "0" ]; then
  echo "⛔ MERGE BLOCKIERT — Erst alle BLOCKER beheben"
  echo "Dann: /clear → /review-deep erneut"
else
  echo "✅ Deep Review bestanden — PR kann nach Approval gemergt werden"
fi
```

## Eskalation bei Security-BLOCKER

Bei OWASP-Severities oder DSGVO-Violations:
1. BLOCKER in docs/30-reviews/ dokumentieren
2. CLAUDE.md > Offene Punkte aktualisieren (@doc-keeper)
3. Fix-Branch von aktuellem Branch: `git checkout -b fix/session-{N}-security`
4. Fix implementieren, neuer Deep-Review
5. NIEMALS Security-BLOCKER in main mergen
