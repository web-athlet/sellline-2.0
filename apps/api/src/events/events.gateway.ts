import { MessageBody, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import type { PingPayload, PongPayload } from '@nextgen/types';

const WEB_ORIGIN = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';

// TODO(session-2): JWT-Handshake-Guard ergänzen (handleConnection prüft client.handshake.auth.token)
@WebSocketGateway({
  cors: { origin: WEB_ORIGIN, credentials: true },
  namespace: '/',
})
export class EventsGateway {
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
