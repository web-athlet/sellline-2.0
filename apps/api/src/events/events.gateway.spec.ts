import { JwtService } from '@nestjs/jwt';
import { describe, expect, it, vi } from 'vitest';
import type { Socket } from 'socket.io';
import { EventsGateway } from './events.gateway';

const stubJwt = (
  verify: JwtService['verify'] = (() => ({
    type: 'access',
    sub: 'u',
    email: 'a',
    role: 'ADMIN',
  })) as JwtService['verify'],
) => ({ verify }) as JwtService;

const fakeSocket = (overrides: Partial<Socket> = {}): Socket =>
  ({
    id: overrides.id ?? 'sock-1',
    handshake: overrides.handshake ?? { auth: {}, headers: {} },
    data: overrides.data ?? {},
    disconnect: overrides.disconnect ?? vi.fn(),
    join: overrides.join ?? vi.fn(),
    leave: overrides.leave ?? vi.fn(),
  }) as unknown as Socket;

describe('EventsGateway', () => {
  it('echoes the ping message back as pong', () => {
    const gateway = new EventsGateway(stubJwt());
    const result = gateway.handlePing({ msg: 'hello', ts: 1 });
    expect(result.event).toBe('pong');
    expect(result.data.msg).toBe('hello');
  });

  it('stamps a fresh server-side timestamp on pong', () => {
    const gateway = new EventsGateway(stubJwt());
    const before = Date.now();
    const result = gateway.handlePing({ msg: 'x', ts: 0 });
    const after = Date.now();
    expect(result.data.ts).toBeGreaterThanOrEqual(before);
    expect(result.data.ts).toBeLessThanOrEqual(after);
  });

  it('handles missing msg gracefully (empty string)', () => {
    const gateway = new EventsGateway(stubJwt());
    const result = gateway.handlePing({ msg: '', ts: 0 });
    expect(result.data.msg).toBe('');
  });

  describe('handshake guard', () => {
    it('disconnects clients with no token', () => {
      const gateway = new EventsGateway(stubJwt());
      const socket = fakeSocket();
      gateway.handleConnection(socket);
      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('attaches user data on valid access token', () => {
      const verify = vi
        .fn()
        .mockReturnValue({ type: 'access', sub: 'u-1', email: 'a@b.c', role: 'SALES_REP' });
      const gateway = new EventsGateway(stubJwt(verify as unknown as JwtService['verify']));
      const socket = fakeSocket({
        handshake: {
          auth: { token: 'jwt.token.here' },
          headers: {},
        } as unknown as Socket['handshake'],
      });
      gateway.handleConnection(socket);
      expect(socket.disconnect).not.toHaveBeenCalled();
      expect(socket.data.user).toEqual({ id: 'u-1', email: 'a@b.c', role: 'SALES_REP' });
    });

    it('disconnects clients with non-access token type', () => {
      const verify = vi.fn().mockReturnValue({ type: 'pre-2fa', sub: 'u-1' });
      const gateway = new EventsGateway(stubJwt(verify as unknown as JwtService['verify']));
      const socket = fakeSocket({
        handshake: { auth: { token: 't' }, headers: {} } as unknown as Socket['handshake'],
      });
      gateway.handleConnection(socket);
      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('disconnects on JWT verify failure', () => {
      const verify = vi.fn().mockImplementation(() => {
        throw new Error('bad sig');
      });
      const gateway = new EventsGateway(stubJwt(verify as unknown as JwtService['verify']));
      const socket = fakeSocket({
        handshake: { auth: { token: 'broken' }, headers: {} } as unknown as Socket['handshake'],
      });
      gateway.handleConnection(socket);
      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('reads token from Authorization Bearer header as fallback', () => {
      const verify = vi
        .fn()
        .mockReturnValue({ type: 'access', sub: 'u-2', email: 'x@y.z', role: 'ADMIN' });
      const gateway = new EventsGateway(stubJwt(verify as unknown as JwtService['verify']));
      const socket = fakeSocket({
        handshake: {
          auth: {},
          headers: { authorization: 'Bearer abc' },
        } as unknown as Socket['handshake'],
      });
      gateway.handleConnection(socket);
      expect(socket.data.user).toEqual({ id: 'u-2', email: 'x@y.z', role: 'ADMIN' });
    });
  });

  describe('pipeline rooms', () => {
    it('rejects pipeline:subscribe from an unauthenticated socket', () => {
      const gateway = new EventsGateway(stubJwt());
      const join = vi.fn();
      const socket = fakeSocket({ join, data: {} } as Partial<Socket>);
      const result = gateway.handlePipelineSubscribe({ pipelineId: 'p-1' }, socket);
      expect(result.event).toBe('error');
      expect(join).not.toHaveBeenCalled();
    });

    it('joins pipeline:<id> room on valid subscribe', () => {
      const gateway = new EventsGateway(stubJwt());
      const join = vi.fn();
      const socket = fakeSocket({
        join,
        data: { user: { id: 'u-1', email: 'a@b', role: 'SALES_REP' } },
      } as Partial<Socket>);
      const result = gateway.handlePipelineSubscribe({ pipelineId: 'p-1' }, socket);
      expect(result.event).toBe('pipeline:subscribed');
      expect(join).toHaveBeenCalledWith('pipeline:p-1');
    });

    it('rejects invalid pipeline id payload', () => {
      const gateway = new EventsGateway(stubJwt());
      const join = vi.fn();
      const socket = fakeSocket({
        join,
        data: { user: { id: 'u-1', email: 'a@b', role: 'SALES_REP' } },
      } as Partial<Socket>);
      const result = gateway.handlePipelineSubscribe(
        { pipelineId: 123 as unknown as string },
        socket,
      );
      expect(result.event).toBe('error');
      expect(join).not.toHaveBeenCalled();
    });

    it('leaves the pipeline room on unsubscribe', () => {
      const gateway = new EventsGateway(stubJwt());
      const leave = vi.fn();
      const socket = fakeSocket({
        leave,
        data: { user: { id: 'u-1', email: 'a@b', role: 'SALES_REP' } },
      } as Partial<Socket>);
      const result = gateway.handlePipelineUnsubscribe({ pipelineId: 'p-9' }, socket);
      expect(result.event).toBe('pipeline:unsubscribed');
      expect(leave).toHaveBeenCalledWith('pipeline:p-9');
    });

    it('emitDealCreated scopes broadcast to the deals pipeline room', () => {
      const gateway = new EventsGateway(stubJwt());
      const emit = vi.fn();
      const to = vi.fn().mockReturnValue({ emit });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal stub
      (gateway as any).server = { to } as unknown;
      gateway.emitDealCreated({
        ts: 1,
        userId: 'u-1',
        dealId: 'd-1',
        pipelineId: 'pipe-7',
        stageId: 's-1',
      });
      expect(to).toHaveBeenCalledWith('pipeline:pipe-7');
      expect(emit).toHaveBeenCalledWith(
        'deal:created',
        expect.objectContaining({ dealId: 'd-1', pipelineId: 'pipe-7' }),
      );
    });

    it('emitDealStageChanged scopes broadcast to the deals pipeline room', () => {
      const gateway = new EventsGateway(stubJwt());
      const emit = vi.fn();
      const to = vi.fn().mockReturnValue({ emit });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal stub
      (gateway as any).server = { to } as unknown;
      gateway.emitDealStageChanged({
        ts: 1,
        userId: 'u-1',
        dealId: 'd-1',
        pipelineId: 'pipe-4',
        oldStageId: 's-1',
        newStageId: 's-2',
        order: 0,
      });
      expect(to).toHaveBeenCalledWith('pipeline:pipe-4');
      expect(emit).toHaveBeenCalledWith(
        'deal:stage_changed',
        expect.objectContaining({ order: 0 }),
      );
    });
  });
});
