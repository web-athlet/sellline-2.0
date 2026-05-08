import { describe, expect, it, vi } from 'vitest';
import { sleep } from './sleep';

describe('sleep', () => {
  it('resolves after the specified delay', async () => {
    vi.useFakeTimers();
    const promise = sleep(50);
    let resolved = false;
    promise.then(() => {
      resolved = true;
    });

    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(49);
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await promise;
    expect(resolved).toBe(true);

    vi.useRealTimers();
  });

  it('resolves with undefined', async () => {
    const result = await sleep(0);
    expect(result).toBeUndefined();
  });
});
