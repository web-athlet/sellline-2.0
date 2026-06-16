import ws from 'k6/ws';
import { check, sleep } from 'k6';

// WebSocket Pulse-Feed — 500 concurrent connections, 10 min (Session 16a, Block 7).
// Uses the Engine.IO/Socket.IO websocket transport. The k6 scaffold sends the
// token through the Authorization header, which the gateway accepts.
// Run: TEST_JWT=<token> WS_URL=ws://localhost:3001 k6 run k6/ws-pulse-load.js
export const options = {
  vus: 500,
  duration: '10m',
  thresholds: {
    ws_connecting: ['p(95)<1000'],
    ws_session_duration: ['p(95)>0'],
  },
};

const WS_URL = __ENV.WS_URL || 'ws://localhost:3001';

export default function () {
  // Socket.IO v4 websocket endpoint.
  const url = `${WS_URL}/socket.io/?EIO=4&transport=websocket`;
  const params = {
    headers: {
      Authorization: `Bearer ${__ENV.TEST_JWT}`,
    },
  };
  const res = ws.connect(url, params, (socket) => {
    socket.on('open', () => {
      // Engine.IO probe + Socket.IO namespace connect.
      socket.send('2probe');
      socket.send('40');
      // Keep the connection alive with periodic Engine.IO pings.
      socket.setInterval(() => socket.send('2'), 20_000);
    });
    socket.setTimeout(() => socket.close(), 60_000);
  });
  check(res, { 'ws handshake 101': (r) => r && r.status === 101 });
  sleep(1);
}
