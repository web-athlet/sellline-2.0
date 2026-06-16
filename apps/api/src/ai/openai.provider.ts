import OpenAI from 'openai';

/** DI token for the shared OpenAI client. `null` when OPENAI_API_KEY is unset,
 *  so agents degrade gracefully (partial enrichment) instead of crashing. */
export const OPENAI_CLIENT = Symbol('OPENAI_CLIENT');

export const openAiProvider = {
  provide: OPENAI_CLIENT,
  useFactory: (): OpenAI | null =>
    process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null,
};
