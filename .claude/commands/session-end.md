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

## Schritt 2: Docs direkt erstellen (create_file + str_replace)

WICHTIG: Keinen @doc-keeper Subagenten beauftragen — direkt mit Tools arbeiten.

Erstelle und verifiziere in dieser Reihenfolge:

### 2a. Session-Summary erstellen
Nutze create_file für docs/20-sessions/session-$ARGUMENTS-summary.md mit:
- Frontmatter (title, tags, status: completed, session, last_updated, summary)
- TLDR (5 Punkte: was gebaut, Schema-Änderungen, Env-Vars, Limitierungen, nächste Session braucht)
- Implementierungsdetails (Backend, Frontend, Tests, ACs, Tech-Debt)

Sofort verifizieren:
```bash
ls -la docs/20-sessions/session-$ARGUMENTS-summary.md
```
Wenn Datei fehlt → nochmal erstellen, nicht weitermachen.

### 2b. Modul-Doc aktualisieren
Nutze str_replace für das relevante docs/10-modules/M*.md:
- status: planned → implemented
- last_updated aktualisieren

Sofort verifizieren:
```bash
grep "status:" docs/10-modules/M*.md
```

### 2c. CLAUDE.md aktualisieren
Nutze str_replace für CLAUDE.md:
- Session $ARGUMENTS Row: ⬜ → ✅
- Version erhöhen (v4.X → v4.X+1)
- Aktive Session auf $ARGUMENTS+1 setzen
- Neue Env-Variablen eintragen falls vorhanden
- Tech-Debts eintragen falls vorhanden

Sofort verifizieren:
```bash
head -3 CLAUDE.md
```

### 2d. Index aktualisieren
Nutze str_replace für docs/99-index.md:
- Session $ARGUMENTS Eintrag in Sessions-Tabelle hinzufügen
- Modul-Status aktualisieren

Sofort verifizieren:
```bash
grep "session-$ARGUMENTS" docs/99-index.md
```

Erst wenn ALLE 4 Verifikationen grün sind → weiter mit Schritt 3.

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
