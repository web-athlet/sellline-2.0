import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { PingPayload, PongPayload } from '@nextgen/types';
import type { Socket } from 'socket.io';
import type { AccessTokenPayload } from '../modules/auth/auth.types';

const WEB_ORIGIN = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';

@WebSocketGateway({
  cors: { origin: WEB_ORIGIN, credentials: true },
  namespace: '/',
})
export class EventsGateway implements OnGatewayConnection {
  private readonly logger = new Logger(EventsGateway.name);

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
}
