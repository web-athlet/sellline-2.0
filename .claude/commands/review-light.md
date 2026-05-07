# Review Light

Tier-2 Code-Review der aktuellen Session. Starte IMMER in neuer Session mit /clear.

---

Führe einen Tier-2 Light-Review der letzten Session durch.

## KRITISCH: Kontext-Isolation prüfen

```bash
# Sicherstellen dass dies eine frische Session ist
echo "Context-Check: Starte Review mit isoliertem Context"

# Scope ermitteln
git log --oneline main..HEAD | head -5
git diff main..HEAD --stat | tail -5
CHANGED_FILES=$(git diff main..HEAD --name-only | wc -l)
echo "Geänderte Dateien: $CHANGED_FILES"
```

## Kontext laden (minimal)

```bash
# Nur das Nötigste
cat CLAUDE.md

# Diff — das ist der primäre Input
git diff main..HEAD

# Welches Modul? → Modul-Doc laden
# (Ableiten aus geänderten Dateien)
```

## Review durchführen

@reviewer — Tier 2 Light Review:

Prüfe den git diff auf die 5 Punkte aus deiner Spezifikation:
1. Offensichtliche Bugs
2. Error-Handling
3. Security-Basics
4. Tests
5. DSGVO

Schreibe das Ergebnis nach docs/30-reviews/session-{N}-light-review.md.

## Nach dem Review

```bash
# Review-Ergebnis anzeigen
cat docs/30-reviews/session-$(git log --oneline main..HEAD | wc -l | xargs)-light-review.md

# BLOCKER zählen
BLOCKERS=$(grep -c "BLOCKER" docs/30-reviews/*.md 2>/dev/null || echo 0)
echo "BLOCKER gefunden: $BLOCKERS"

if [ "$BLOCKERS" -gt "0" ]; then
  echo "⚠️  BLOCKER müssen vor Merge behoben werden"
  echo "Zurück zum Builder: Fixes implementieren, dann /review-light erneut"
elif [ "$BLOCKERS" -gt "2" ]; then
  echo "⚠️  3+ BLOCKER: Empfehle Eskalation zu /review-deep"
else
  echo "✅ Review clean — PR kann gemergt werden"
fi
```
