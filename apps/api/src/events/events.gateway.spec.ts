import { describe, expect, it } from 'vitest';
import { EventsGateway } from './events.gateway';

describe('EventsGateway', () => {
  const gateway = new EventsGateway();

  it('echoes the ping message back as pong', () => {
    const result = gateway.handlePing({ msg: 'hello', ts: 1 });
    expect(result.event).toBe('pong');
    expect(result.data.msg).toBe('hello');
  });

  it('stamps a fresh server-side timestamp on pong', () => {
    const before = Date.now();
    const result = gateway.handlePing({ msg: 'x', ts: 0 });
    const after = Date.now();
    expect(result.data.ts).toBeGreaterThanOrEqual(before);
    expect(result.data.ts).toBeLessThanOrEqual(after);
  });

  it('handles missing msg gracefully (empty string)', () => {
    const result = gateway.handlePing({ msg: '', ts: 0 });
    expect(result.data.msg).toBe('');
  });
});
