// Pure cost estimation for AI runs. Pricing constants reflect GPT-4o list prices
// (USD per 1M tokens) and can be overridden via env for future price/model changes.

const GPT4O_INPUT_USD_PER_1M = Number(process.env.OPENAI_GPT4O_INPUT_USD_PER_1M ?? 2.5);
const GPT4O_OUTPUT_USD_PER_1M = Number(process.env.OPENAI_GPT4O_OUTPUT_USD_PER_1M ?? 10);
const SERPER_USD_PER_CREDIT = Number(process.env.SERPER_USD_PER_CREDIT ?? 0.001);

export function estimateOpenAiCostUsd(tokensIn: number, tokensOut: number): number {
  return (
    (tokensIn / 1_000_000) * GPT4O_INPUT_USD_PER_1M +
    (tokensOut / 1_000_000) * GPT4O_OUTPUT_USD_PER_1M
  );
}

export function estimateSerperCostUsd(credits: number): number {
  return credits * SERPER_USD_PER_CREDIT;
}

export interface RunCostInput {
  serperCredits: number;
  openaiTokensIn: number;
  openaiTokensOut: number;
}

/** Total estimated USD for one enrichment run, rounded to 6 decimals (micro-USD). */
export function estimateRunCostUsd(input: RunCostInput): number {
  const total =
    estimateSerperCostUsd(input.serperCredits) +
    estimateOpenAiCostUsd(input.openaiTokensIn, input.openaiTokensOut);
  return Math.round(total * 1_000_000) / 1_000_000;
}
