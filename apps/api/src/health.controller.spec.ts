import { describe, expect, it } from 'vitest';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const controller = new HealthController();

  it('returns status ok', () => {
    expect(controller.check().status).toBe('ok');
  });

  it('returns a numeric uptime', () => {
    const result = controller.check();
    expect(typeof result.uptime).toBe('number');
    expect(result.uptime).toBeGreaterThanOrEqual(0);
  });

  it('returns a recent timestamp', () => {
    const before = Date.now();
    const result = controller.check();
    const after = Date.now();
    expect(result.timestamp).toBeGreaterThanOrEqual(before);
    expect(result.timestamp).toBeLessThanOrEqual(after);
  });
});
