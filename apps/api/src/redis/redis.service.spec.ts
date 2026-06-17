import { beforeEach, describe, expect, it, vi } from 'vitest';

// Shared controllable ioredis stand-in — every `new Redis()` returns this object.
const clientMock = {
  status: 'wait' as string,
  on: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  keys: vi.fn(),
  del: vi.fn(),
  ping: vi.fn(),
  quit: vi.fn(),
  disconnect: vi.fn(),
};

vi.mock('ioredis', () => ({ default: vi.fn(() => clientMock) }));

// eslint-disable-next-line import/first
import { RedisService } from './redis.service';

describe('RedisService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clientMock.status = 'wait';
  });

  describe('ping', () => {
    it('returns true on PONG', async () => {
      clientMock.ping.mockResolvedValue('PONG');
      await expect(new RedisService().ping()).resolves.toBe(true);
    });

    it('returns false on a non-PONG reply', async () => {
      clientMock.ping.mockResolvedValue('nope');
      await expect(new RedisService().ping()).resolves.toBe(false);
    });

    it('returns false (never throws) when the client rejects', async () => {
      clientMock.ping.mockRejectedValue(new Error('connection refused'));
      await expect(new RedisService().ping()).resolves.toBe(false);
    });
  });

  describe('onModuleDestroy (TD-S16a-02)', () => {
    it('disconnects without calling quit on a never-connected client', async () => {
      clientMock.status = 'wait';
      await new RedisService().onModuleDestroy();
      expect(clientMock.quit).not.toHaveBeenCalled();
      expect(clientMock.disconnect).toHaveBeenCalledOnce();
    });

    it('quits gracefully when connected', async () => {
      clientMock.status = 'ready';
      clientMock.quit.mockResolvedValue('OK');
      await new RedisService().onModuleDestroy();
      expect(clientMock.quit).toHaveBeenCalledOnce();
      expect(clientMock.disconnect).not.toHaveBeenCalled();
    });

    it('falls back to disconnect if quit throws', async () => {
      clientMock.status = 'ready';
      clientMock.quit.mockRejectedValue(new Error("Stream isn't writeable"));
      await new RedisService().onModuleDestroy();
      expect(clientMock.quit).toHaveBeenCalledOnce();
      expect(clientMock.disconnect).toHaveBeenCalledOnce();
    });
  });
});
