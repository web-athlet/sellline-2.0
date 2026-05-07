# Module

Lädt den Kontext eines spezifischen Moduls. Verwendung: /module M3 oder /module deals

---

Lade den Kontext für Modul: $ARGUMENTS

```bash
# Modul-Datei finden (flexibel: M3, deals, M3-deals alle funktionieren)
MODULE_ARG=$(echo "$ARGUMENTS" | tr '[:upper:]' '[:lower:]')
MODULE_FILE=$(find docs/10-modules/ -name "*.md" | grep -i "$MODULE_ARG" | head -1)

if [ -z "$MODULE_FILE" ]; then
  echo "Modul nicht gefunden: $ARGUMENTS"
  echo "Verfügbare Module:"
  ls docs/10-modules/*.md | grep -v _template
else
  echo "Lade: $MODULE_FILE"
  cat "$MODULE_FILE"

  # Verwandte Module aus frontmatter laden (nur Frontmatter)
  echo ""
  echo "=== Verwandte Module (nur Summary) ==="
  RELATED=$(grep "^related:" "$MODULE_FILE" | sed 's/related: \[//' | tr ',' '\n' | tr -d '[]" ')
  for rel in $RELATED; do
    REL_FILE=$(find docs/10-modules/ -name "*${rel}*.md" | head -1)
    if [ -n "$REL_FILE" ]; then
      echo "--- $rel ---"
      grep -A2 "^summary:" "$REL_FILE" | head -3
    fi
  done
fi
```

Antworte mit einer kurzen Zusammenfassung des geladenen Modul-Kontexts und ob
alle kritischen Business-Regeln klar sind.
