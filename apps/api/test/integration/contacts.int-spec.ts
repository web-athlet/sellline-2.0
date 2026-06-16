import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { type BaseGraph, closeTestApp, createTestApp, resetDb, seedBaseGraph } from './app';

describe('Contacts (integration)', () => {
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

  it('creates a contact and returns it in the paginated list', async () => {
    const create = await request(app.getHttpServer())
      .post('/api/v1/contacts')
      .set('Authorization', `Bearer ${graph.token}`)
      .send({ firstName: 'Ada', lastName: 'Lovelace', emails: ['ada@test.local'] });

    expect(create.status).toBe(201);

    const list = await request(app.getHttpServer())
      .get('/api/v1/contacts')
      .set('Authorization', `Bearer ${graph.token}`);

    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBe(1);
    expect(list.body.data[0]).toMatchObject({ firstName: 'Ada', lastName: 'Lovelace' });
  });

  it('rejects an invalid email via the ValidationPipe', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/contacts')
      .set('Authorization', `Bearer ${graph.token}`)
      .send({ firstName: 'Bad', lastName: 'Email', emails: ['not-an-email'] });

    expect(res.status).toBe(400);
  });
});
