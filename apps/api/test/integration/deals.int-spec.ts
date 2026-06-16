import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { type BaseGraph, closeTestApp, createTestApp, resetDb, seedBaseGraph } from './app';

describe('Deals (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let graph: BaseGraph;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  beforeEach(async () => {
    await resetDb(prisma);
    graph = await seedBaseGraph(app, prisma);
  });

  it('creates a deal, defaults the owner to the caller, and persists it', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/deals')
      .set('Authorization', `Bearer ${graph.token}`)
      .send({
        title: 'Test-Deal',
        value: 10_000,
        pipelineId: graph.pipelineId,
        stageId: graph.stageId,
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();

    const deal = await prisma.deal.findUnique({ where: { id: res.body.id } });
    expect(deal?.ownerId).toBe(graph.user.id);
    expect(deal?.stageId).toBe(graph.stageId);
    expect(Number(deal?.value)).toBe(10_000);
  });

  it('rejects creation without a bearer token (JwtAuthGuard)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/deals')
      .send({ title: 'No-Auth', pipelineId: graph.pipelineId, stageId: graph.stageId });

    expect(res.status).toBe(401);
  });

  it('rejects a stage that does not belong to the pipeline', async () => {
    const otherPipeline = await prisma.pipeline.create({ data: { name: 'Other' } });
    const res = await request(app.getHttpServer())
      .post('/api/v1/deals')
      .set('Authorization', `Bearer ${graph.token}`)
      .send({ title: 'Bad-Stage', pipelineId: otherPipeline.id, stageId: graph.stageId });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});
