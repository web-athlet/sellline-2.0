import type { INestApplication } from '@nestjs/common';
import { Role } from '@nextgen/db';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { userFactory } from '../factories';
import {
  type BaseGraph,
  closeTestApp,
  createTestApp,
  flushRedis,
  resetDb,
  seedBaseGraph,
  signAccessToken,
} from './app';

describe('GDPR export (integration)', () => {
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
    await flushRedis();
    graph = await seedBaseGraph(app, prisma);
  });

  it('streams a ZIP for the data subject (Art. 20)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/gdpr/export/${graph.user.id}`)
      .set('Authorization', `Bearer ${graph.token}`)
      .buffer(true);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/zip');
    expect(res.headers['content-disposition']).toContain(`gdpr-export-${graph.user.id}.zip`);
  });

  it('rate-limits a second export within 24h to 429 (per-user, Redis-backed)', async () => {
    const url = `/api/v1/gdpr/export/${graph.user.id}`;
    const first = await request(app.getHttpServer())
      .get(url)
      .set('Authorization', `Bearer ${graph.token}`)
      .buffer(true);
    expect(first.status).toBe(200);

    const second = await request(app.getHttpServer())
      .get(url)
      .set('Authorization', `Bearer ${graph.token}`)
      .buffer(true);
    expect(second.status).toBe(429);
  });

  it('forbids a non-admin exporting another user', async () => {
    const other = await prisma.user.create({
      data: userFactory.build({ role: Role.SALES_REP, passwordChangedAt: null }),
    });
    const otherToken = signAccessToken(app, other);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/gdpr/export/${graph.user.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .buffer(true);

    expect(res.status).toBe(403);
  });
});
