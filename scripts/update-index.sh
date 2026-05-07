#!/bin/bash
# scripts/update-index.sh
# Aktualisiert docs/99-index.md aus Frontmatter aller .md Dateien
# Aufruf: bash scripts/update-index.sh

echo "Aktualisiere docs/99-index.md..."

python3 << 'PYEOF'
import os, re
from datetime import date

def get_frontmatter(filepath):
    try:
        with open(filepath) as f:
            content = f.read()
        if not content.startswith('---'):
            return {}
        fm_end = content.index('---', 3)
        fm = content[3:fm_end]
        result = {}
        for line in fm.strip().split('\n'):
            if ':' in line:
                key, _, val = line.partition(':')
                result[key.strip()] = val.strip().strip('"')
        return result
    except:
        return {}

sections = {
    '10-modules': [],
    '20-sessions': [],
    '40-decisions': [],
    '50-runbooks': [],
    '60-prompts': [],
}

for folder in sections:
    path = f'docs/{folder}'
    if not os.path.exists(path):
        continue
    for fname in sorted(os.listdir(path)):
        if fname.startswith('_') or not fname.endswith('.md'):
            continue
        fm = get_frontmatter(f'{path}/{fname}')
        sections[folder].append({
            'file': fname,
            'status': fm.get('status', '—'),
            'summary': fm.get('summary', '(kein Summary)'),
        })

today = date.today().isoformat()
lines = [
    '---',
    'title: "Gesamt-Index aller Docs"',
    'tags: [index, navigation, all-docs]',
    'status: active',
    f'last_updated: {today}',
    'summary: "Vollstaendiger Index aller Second-Brain-Dokumente."',
    '---',
    '',
    '# Gesamt-Index — NextGen CRM Second Brain',
    '',
    f'> Zuletzt aktualisiert: {today} von @doc-keeper / update-index.sh',
    '> Agents: Scanne diesen Index ZUERST um zu entscheiden was zu laden ist.',
    '',
]

labels = {
    '10-modules': ('Module', 'Datei | Status | Summary'),
    '20-sessions': ('Sessions', 'Datei | Status | Summary'),
    '40-decisions': ('Entscheidungen (ADRs)', 'Datei | Status | Summary'),
    '50-runbooks': ('Runbooks', 'Datei | Summary'),
    '60-prompts': ('KI-Prompts', 'Datei | Summary'),
}

for folder, items in sections.items():
    if not items:
        continue
    label, header = labels[folder]
    lines.append(f'## {label} ({folder}/)')
    lines.append('')
    lines.append('| ' + ' | '.join(header.split(' | ')) + ' |')
    lines.append('|' + '---|' * len(header.split(' | ')))
    for item in items:
        if folder in ('50-runbooks', '60-prompts'):
            lines.append(f"| {item['file']} | {item['summary']} |")
        else:
            lines.append(f"| {item['file']} | {item['status']} | {item['summary']} |")
    lines.append('')

with open('docs/99-index.md', 'w') as f:
    f.write('\n'.join(lines))

print(f"docs/99-index.md aktualisiert ({sum(len(v) for v in sections.values())} Eintraege)")
PYEOF
