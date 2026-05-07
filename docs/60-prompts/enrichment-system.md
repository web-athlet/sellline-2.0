---
title: "KI-Prompt: Enrichment System-Prompt"
tags: [prompt, enrichment, gpt-4o, ai-agent]
status: active
last_updated: 2026-05-07
summary: "System- und User-Prompt fuer den Enrichment-Worker (GPT-4o, JSON-Schema-Output)."
---
# Enrichment-Prompts (GPT-4o)

## System-Prompt
```
Du bist ein B2B-Daten-Extraktor. Extrahiere aus Website-Snippets strukturierte
Firmendaten. Antworte NUR mit validem JSON nach dem vorgegebenen Schema.
Keine Halluzinationen: wenn ein Feld nicht ableitbar ist, verwende null.
Keine Erklaerungen, kein Markdown — ausschliesslich JSON.
```

## User-Prompt Template (TypeScript)
```typescript
export const ENRICHMENT_USER = (snippets: string[]) => `
Analysiere diese Website-Snippets und extrahiere Firmendaten:

${snippets.map((s, i) => `[${i + 1}] ${s}`).join('\n\n')}

Antworte ausschliesslich mit diesem JSON-Schema:
{
  "branche": "string oder null",
  "mitarbeiterzahl": "number oder null",
  "jahresumsatz": "number in EUR oder null",
  "headquarter": "Stadt, Land oder null",
  "techStack": ["array of strings oder leer"],
  "socialProfiles": {
    "linkedin": "URL oder null",
    "xing": "URL oder null",
    "twitter": "URL oder null"
  },
  "confidence": "0.0 bis 1.0 — wie sicher bist du?"
}
`;
```

## Konfiguration
- model: gpt-4o
- temperature: 0.2 (niedrig fuer Fakten-Extraktion)
- response_format: { type: 'json_object' }
- max_tokens: 500

## Kosten-Tracking
Nach jedem Call:
```typescript
const cost = {
  serperCredits: 1,
  openaiTokensIn: usage.prompt_tokens,
  openaiTokensOut: usage.completion_tokens,
  estCostUsd: (usage.prompt_tokens * 0.0025 + usage.completion_tokens * 0.01) / 1000,
};
```
