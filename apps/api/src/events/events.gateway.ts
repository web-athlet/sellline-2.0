import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type {
  DealCreatedEvent,
  DealDeletedEvent,
  DealRotIndicatorEvent,
  DealStageChangedEvent,
  DealUpdatedEvent,
  PingPayload,
  PongPayload,
  PulseFeedUpdatedEvent,
} from '@nextgen/types';
import type { Server, Socket } from 'socket.io';
import type { AccessTokenPayload } from '../modules/auth/auth.types';

const PIPELINE_ROOM = (id: string): string => `pipeline:${id}`;
const USER_ROOM = (id: string): string => `user:${id}`;

const WEB_ORIGIN = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';

@WebSocketGateway({
  cors: { origin: WEB_ORIGIN, credentials: true },
  namespace: '/',
})
export class EventsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly jwt: JwtService) {}

  handleConnection(client: Socket): void {
    const token = this.extractToken(client);
    if (!token) {
      this.logger.warn(`[WS] connection rejected — no token (sid=${client.id})`);
      client.disconnect(true);
      return;
    }
    try {
      const payload = this.jwt.verify<AccessTokenPayload>(token);
      if (payload.type !== 'access') {
        client.disconnect(true);
        return;
      }
      client.data.user = { id: payload.sub, email: payload.email, role: payload.role };
      // Each authenticated socket joins a personal room for user-scoped events
      // (pulse:feed_updated, future notification events).
      void client.join(USER_ROOM(payload.sub));
    } catch {
      this.logger.warn(`[WS] connection rejected — invalid token (sid=${client.id})`);
      client.disconnect(true);
    }
  }

  private extractToken(client: Socket): string | undefined {
    const auth = (client.handshake.auth ?? {}) as { token?: string };
    if (auth.token) return auth.token;
    const header = client.handshake.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length);
    return undefined;
  }

  @SubscribeMessage('ping')
  handlePing(@MessageBody() data: PingPayload): { event: 'pong'; data: PongPayload } {
    return {
      event: 'pong',
      data: {
        msg: data.msg,
        ts: Date.now(),
      },
    };
  }

  // Clients opening a Kanban/list for a given pipeline subscribe to the
  // corresponding room. Deal events are then scoped to that room so they do not
  // leak to unrelated sessions.
  @SubscribeMessage('pipeline:subscribe')
  handlePipelineSubscribe(
    @MessageBody() data: { pipelineId?: unknown },
    @ConnectedSocket() client: Socket,
  ):
    | { event: 'pipeline:subscribed'; data: { pipelineId: string } }
    | { event: 'error'; data: { reason: string } } {
    if (!client.data?.user) {
      return { event: 'error', data: { reason: 'unauthenticated' } };
    }
    if (typeof data?.pipelineId !== 'string' || data.pipelineId.length === 0) {
      return { event: 'error', data: { reason: 'invalid_pipeline_id' } };
    }
    void client.join(PIPELINE_ROOM(data.pipelineId));
    return { event: 'pipeline:subscribed', data: { pipelineId: data.pipelineId } };
  }

  @SubscribeMessage('pipeline:unsubscribe')
  handlePipelineUnsubscribe(
    @MessageBody() data: { pipelineId?: unknown },
    @ConnectedSocket() client: Socket,
  ):
    | { event: 'pipeline:unsubscribed'; data: { pipelineId: string } }
    | { event: 'error'; data: { reason: string } } {
    if (typeof data?.pipelineId !== 'string' || data.pipelineId.length === 0) {
      return { event: 'error', data: { reason: 'invalid_pipeline_id' } };
    }
    void client.leave(PIPELINE_ROOM(data.pipelineId));
    return { event: 'pipeline:unsubscribed', data: { pipelineId: data.pipelineId } };
  }

  emitDealCreated(payload: DealCreatedEvent): void {
    this.server?.to(PIPELINE_ROOM(payload.pipelineId)).emit('deal:created', payload);
  }

  emitDealUpdated(payload: DealUpdatedEvent): void {
    this.server?.to(PIPELINE_ROOM(payload.pipelineId)).emit('deal:updated', payload);
  }

  emitDealStageChanged(payload: DealStageChangedEvent): void {
    this.server?.to(PIPELINE_ROOM(payload.pipelineId)).emit('deal:stage_changed', payload);
  }

  emitDealDeleted(payload: DealDeletedEvent): void {
    this.server?.to(PIPELINE_ROOM(payload.pipelineId)).emit('deal:deleted', payload);
  }

  emitDealRotIndicator(payload: DealRotIndicatorEvent): void {
    this.server?.to(PIPELINE_ROOM(payload.pipelineId)).emit('deal:rot_indicator', payload);
  }

  emitPulseFeedUpdated(userId: string, tab: PulseFeedUpdatedEvent['tab']): void {
    const payload: PulseFeedUpdatedEvent = { userId, tab, ts: Date.now() };
    this.server?.to(USER_ROOM(userId)).emit('pulse:feed_updated', payload);
  }
}
