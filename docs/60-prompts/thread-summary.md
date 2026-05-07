---
title: "KI-Prompt: E-Mail-Thread-Summary"
tags: [prompt, email, thread-summary, gpt-4o, m6]
status: active
last_updated: 2026-05-07
summary: "GPT-4o-Prompt fuer Thread-Summary bei >5 E-Mails. Keine E-Mail-Bodies an OpenAI (DSGVO)."
---
# Thread-Summary-Prompt (M6 E-Mail)

## DSGVO-Kritisch
E-Mail-Bodies sind AES-256-GCM verschluesselt gespeichert.
Fuer GPT-4o: NIEMALS `bodyEncrypted` senden.
Nur: Betreff, Absender-Domain, Datum, Anzahl E-Mails im Thread.

## System-Prompt
```
Du bist ein Sales-Assistent. Fasse E-Mail-Thread-Metadaten zusammen.
Du siehst keine E-Mail-Inhalte — nur Metadaten (Betreff, Domain, Datum).
Erstelle eine kurze, sachliche Zusammenfassung des Thread-Verlaufs.
```

## User-Prompt Template
```typescript
export const THREAD_SUMMARY_USER = (metadata: ThreadMetadata[]) => `
Thread-Metadaten (${metadata.length} E-Mails):
${metadata.map(m => `- ${m.date}: Von ${m.senderDomain} | Betreff: "${m.subject}"`).join('\n')}

Erstelle eine 2-3-saetzige Zusammenfassung:
- Was ist der Kontext dieses Austauschs?
- Was ist der letzte Stand / naechster Schritt?
`;
```

## Konfiguration
- model: gpt-4o
- temperature: 0.3
- max_tokens: 200 (kurze Summary)
