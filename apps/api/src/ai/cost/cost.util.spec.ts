import { estimateOpenAiCostUsd, estimateRunCostUsd, estimateSerperCostUsd } from './cost.util';

describe('cost.util', () => {
  it('prices GPT-4o input at $2.50 / 1M tokens', () => {
    expect(estimateOpenAiCostUsd(1_000_000, 0)).toBeCloseTo(2.5, 6);
  });

  it('prices GPT-4o output at $10 / 1M tokens', () => {
    expect(estimateOpenAiCostUsd(0, 1_000_000)).toBeCloseTo(10, 6);
  });

  it('prices Serper at $0.001 / credit', () => {
    expect(estimateSerperCostUsd(1)).toBeCloseTo(0.001, 6);
    expect(estimateSerperCostUsd(5)).toBeCloseTo(0.005, 6);
  });

  it('sums a full run (1 credit, 2300 in, 450 out)', () => {
    // 0.001 + (2300/1e6*2.5) + (450/1e6*10) = 0.001 + 0.00575 + 0.0045 = 0.01125
    expect(
      estimateRunCostUsd({ serperCredits: 1, openaiTokensIn: 2300, openaiTokensOut: 450 }),
    ).toBeCloseTo(0.01125, 6);
  });

  it('rounds to micro-USD (6 decimals)', () => {
    const v = estimateRunCostUsd({ serperCredits: 0, openaiTokensIn: 1, openaiTokensOut: 0 });
    expect(Number.isFinite(v)).toBe(true);
    expect(v.toString().split('.')[1]?.length ?? 0).toBeLessThanOrEqual(6);
  });
});
