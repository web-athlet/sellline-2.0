// GPT-4o prompt templates for the B2B enrichment agent. Kept in a dedicated file so
// prompt-engineering changes are reviewable in isolation.

export const ENRICHMENT_SYSTEM = `Du bist ein B2B-Daten-Extraktor. Extrahiere aus den folgenden Website-Snippets strukturierte Firmen-Daten. Antworte NUR mit validem JSON nach Schema.`;

export const ENRICHMENT_USER = (snippets: string[]): string => `
Snippets:
${snippets.map((s, i) => `[${i + 1}] ${s}`).join('\n\n')}

JSON-Schema: { branche, mitarbeiterzahl, jahresumsatz, headquarter, techStack[], socialProfiles{} }
Wenn ein Feld nicht ableitbar ist: null. Keine Halluzinationen.
`;
