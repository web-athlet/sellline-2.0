import { ONCE_PER_DAY, TWICE_PER_HOUR, UserThrottlerGuard } from './user-throttler.guard';

type TrackerAccess = { getTracker(req: Record<string, unknown>): Promise<string> };

// Bypass the ThrottlerGuard constructor (DI-only deps) to unit-test getTracker.
const guard = Object.create(UserThrottlerGuard.prototype) as TrackerAccess;

describe('UserThrottlerGuard.getTracker', () => {
  it('tracks by authenticated user id', async () => {
    await expect(guard.getTracker({ user: { id: 'u1' }, ip: '1.2.3.4' })).resolves.toBe('u1');
  });

  it('falls back to ip for anonymous requests', async () => {
    await expect(guard.getTracker({ ip: '1.2.3.4' })).resolves.toBe('1.2.3.4');
  });

  it('falls back to a constant when neither is present', async () => {
    await expect(guard.getTracker({})).resolves.toBe('anonymous');
  });
});

describe('throttle presets', () => {
  it('ONCE_PER_DAY = 1 request / 24h', () => {
    expect(ONCE_PER_DAY.default).toEqual({ limit: 1, ttl: 24 * 60 * 60 * 1000 });
  });
  it('TWICE_PER_HOUR = 2 requests / 1h', () => {
    expect(TWICE_PER_HOUR.default).toEqual({ limit: 2, ttl: 60 * 60 * 1000 });
  });
});
