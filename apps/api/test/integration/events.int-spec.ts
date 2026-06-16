import type { INestApplication } from '@nestjs/common';
import type { AddressInfo } from 'node:net';
import type { Socket } from 'socket.io-client';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { type BaseGraph, closeTestApp, createTestApp, resetDb, seedBaseGraph } from './app';
import { connectTestSocket, openSocket, waitForEvent } from './ws-client';

describe('WebSocket events (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let port: number;
  let graph: BaseGraph;
  let socket: Socket | undefined;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    // Bind the HTTP server (and the socket.io gateway attached to it) to a port.
    await app.listen(0);
    port = (app.getHttpServer().address() as AddressInfo).port;
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  beforeEach(async () => {
    await resetDb(prisma);
    graph = await seedBaseGraph(app, prisma);
  });

  afterEach(() => {
    socket?.close();
    socket = undefined;
  });

  it('kicks a connection presenting an invalid token', async () => {
    // The gateway authenticates in handleConnection (not the handshake), so the
    // client briefly connects, then the server disconnects it. Attach the
    // disconnect listener before the kick to avoid a race.
    socket = openSocket(port, 'not-a-jwt');
    const reason = await waitForEvent<string>(socket, 'disconnect');
    expect(reason).toBe('io server disconnect');
  });

  it('delivers deal:created to a subscriber of the deal pipeline room', async () => {
    socket = await connectTestSocket(port, graph.token);

    // Subscribe to the pipeline room and wait for the server's confirmation
    // message (Nest emits the WsResponse as a `pipeline:subscribed` event).
    const subscribed = waitForEvent(socket, 'pipeline:subscribed');
    socket.emit('pipeline:subscribe', { pipelineId: graph.pipelineId });
    await subscribed;

    // Listener attached before the HTTP create that triggers the broadcast.
    const dealCreated = waitForEvent<{ dealId: string; pipelineId: string }>(
      socket,
      'deal:created',
    );

    const res = await request(app.getHttpServer())
      .post('/api/v1/deals')
      .set('Authorization', `Bearer ${graph.token}`)
      .send({ title: 'WS-Deal', pipelineId: graph.pipelineId, stageId: graph.stageId });
    expect(res.status).toBe(201);

    const event = await dealCreated;
    expect(event.dealId).toBe(res.body.id);
    expect(event.pipelineId).toBe(graph.pipelineId);
  });
});
