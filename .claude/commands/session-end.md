# Session End

Schließt Session $ARGUMENTS ab: Docs, Commit, PR-Vorbereitung.

---

Session $ARGUMENTS ist abgeschlossen. Führe den Session-Closer durch.

## Schritt 1: Quality-Gate (MUSS grün sein vor Closer)

```bash
cd /path/to/nextgen-crm
bash scripts/quality-gate.sh
```

Wenn Quality-Gate FAIL: **STOPP**. Erst Fehler beheben, dann erneut `/session-end $ARGUMENTS`.

## Schritt 2: @doc-keeper beauftragen

Rufe @doc-keeper mit folgenden Informationen:

```
@doc-keeper Erstelle Session-Summary für Session $ARGUMENTS.

Implementiert wurde: [Zusammenfassung der Session]

Schema-Änderungen (neue/geänderte Prisma-Models):
[Liste]

Neue Env-Variablen:
[Liste oder "keine"]

Bekannte Limitierungen / Tech-Debt:
[Liste oder "keine"]

Nächste Session-Abhängigkeiten:
[Was muss für Session N+1 vorhanden sein]

AC-Status:
[Welche ACs wurden erfüllt, welche nicht]

Coverage nach Session:
Unit: x% | Integration: x%
```

Warte auf Bestätigung von @doc-keeper, dass folgende Dateien aktualisiert wurden:
- [ ] docs/20-sessions/session-{N}-summary.md erstellt
- [ ] CLAUDE.md Session-Status aktualisiert (⬜ → ✅)
- [ ] CLAUDE.md Env-Variablen ergänzt
- [ ] CLAUDE.md Offene Punkte aktualisiert
- [ ] docs/10-modules/M*.md Status aktualisiert
- [ ] docs/99-index.md aktualisiert

## Schritt 3: Git-Commit

```bash
# Conventional Commit mit Co-Author
git add -A
git commit -m "feat(session-$ARGUMENTS): $(git log --oneline -1 | cut -d' ' -f2-)" \
  -m "" \
  -m "Co-authored-by: Claude <claude@anthropic.com>"

# Docs separat committen
git add docs/ CLAUDE.md
git commit -m "docs(session-$ARGUMENTS): update second brain" \
  -m "Co-authored-by: Claude <claude@anthropic.com>"
```

## Schritt 4: Push + PR-Vorbereitung

```bash
git push -u origin feature/session-$ARGUMENTS-$(git branch --show-current | sed 's/feature\/session-[0-9]*-//')

echo "PR-Titel: feat(session-$ARGUMENTS): [Modul-Name]"
echo "Labels: session-$ARGUMENTS, $([ $ARGUMENTS -le 5 ] && echo 'critical-path' || echo 'standard')"
```

## Schritt 5: Review-Erinnerung

Ausgabe für User:

```
## Session $ARGUMENTS — Abgeschlossen ✅

Quality-Gate: PASS
Docs: aktualisiert
Commit: gepusht
PR: bereit zum Öffnen

## Nächster Schritt: Code-Review

Öffne eine NEUE Claude-Code-Session:
  claude                    # neues Terminal-Fenster
  /clear                    # wichtig: isolierter Context
  /review-light             # Standard-Review

Kritische Sessions (0,1,2,5,11,14,15): /review-deep statt /review-light
```
