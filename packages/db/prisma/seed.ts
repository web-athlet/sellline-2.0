// Idempotent seed for NextGen CRM dev DB.
// Re-runs use upsert with deterministic UUIDv5 IDs → no duplicates.

import {
  ActivityType,
  CampaignStatus,
  PrismaClient,
  Priority,
  ProjectStatus,
  Role,
} from '@prisma/client';
import { fakerDE as faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';
import { v5 as uuidv5 } from 'uuid';

// Refuse to run against a production database — demo accounts must never land
// in prod. Override with SEED_ALLOW_PROD=1 only for explicit migration drills.
if (process.env.NODE_ENV === 'production' && process.env.SEED_ALLOW_PROD !== '1') {
  console.error('❌ Seed refused: NODE_ENV=production. Set SEED_ALLOW_PROD=1 to override.');
  process.exit(1);
}

const prisma = new PrismaClient();

const NS = '7e1b2c3d-4e5f-5a6b-8c7d-9e0f1a2b3c4d';
const id = (key: string): string => uuidv5(key, NS);

faker.seed(42);

const ORG_NAMES = [
  'Bauer GmbH',
  'Schmidt AG',
  'Müller IT Solutions',
  'Weber Industries',
  'Fischer & Söhne',
  'Becker Consulting',
  'Meyer Logistik',
  'Wagner Software',
  'Hoffmann Maschinenbau',
  'Schulz Pharma',
] as const;

const STAGES = [
  { name: 'Qualifiziert', color: '#94a3b8' },
  { name: 'Demo geplant', color: '#60a5fa' },
  { name: 'Demo abgeschlossen', color: '#3b82f6' },
  { name: 'Angebot abgegeben', color: '#f59e0b' },
  { name: 'Verhandlungen', color: '#ef4444' },
  { name: 'Vertrag unterschrieben', color: '#10b981' },
] as const;

const PRODUCTS = [
  { name: 'Starter-Lizenz', code: 'STARTER-001', billingFreq: 'MONTHLY', price: 49 },
  { name: 'Pro-Lizenz', code: 'PRO-001', billingFreq: 'MONTHLY', price: 149 },
  { name: 'Enterprise-Paket', code: 'ENT-001', billingFreq: 'YEARLY', price: 12000 },
  { name: 'Onboarding-Service', code: 'SVC-001', billingFreq: 'ONE_TIME', price: 1500 },
  { name: 'Premium-Support', code: 'SUP-001', billingFreq: 'YEARLY', price: 3600 },
] as const;

const ACTIVITY_TYPES: ActivityType[] = [
  ActivityType.CALL,
  ActivityType.MEETING,
  ActivityType.TASK,
  ActivityType.DEADLINE,
  ActivityType.EMAIL,
  ActivityType.LUNCH,
];

const DAY_MS = 86_400_000;
const now = new Date();

function dueDateFor(i: number): Date {
  const bucket = i % 3;
  if (bucket === 0) return new Date(now.getTime() - (i + 1) * DAY_MS); // überfällig
  if (bucket === 1) return now; // heute
  return new Date(now.getTime() + ((i % 7) + 1) * DAY_MS); // diese Woche
}

async function seedUsers(): Promise<{ admin: string; manager: string; sales: string }> {
  const password = await bcrypt.hash('Demo1234!', 12);

  const users = [
    { id: id('user-admin'), email: 'admin@demo.de', name: 'Anna Admin', role: Role.ADMIN },
    { id: id('user-manager'), email: 'manager@demo.de', name: 'Max Manager', role: Role.MANAGER },
    { id: id('user-sales'), email: 'sales@demo.de', name: 'Sara Sales', role: Role.SALES_REP },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, password },
      create: { id: u.id, email: u.email, name: u.name, role: u.role, password },
    });
  }

  return { admin: id('user-admin'), manager: id('user-manager'), sales: id('user-sales') };
}

async function seedPipelineAndStages(): Promise<{ pipelineId: string; stageIds: string[] }> {
  const pipelineId = id('pipeline-default');

  await prisma.pipeline.upsert({
    where: { id: pipelineId },
    update: { name: 'Vertriebs-Pipeline', isDefault: true, rotThresholdDays: 7 },
    create: {
      id: pipelineId,
      name: 'Vertriebs-Pipeline',
      isDefault: true,
      rotThresholdDays: 7,
    },
  });

  const stageIds: string[] = [];
  for (let i = 0; i < STAGES.length; i++) {
    const stage = STAGES[i]!;
    const stageId = id(`stage-${i}`);
    await prisma.stage.upsert({
      where: { pipelineId_order: { pipelineId, order: i } },
      update: { name: stage.name, color: stage.color },
      create: { id: stageId, pipelineId, name: stage.name, order: i, color: stage.color },
    });
    stageIds.push(stageId);
  }

  return { pipelineId, stageIds };
}

async function seedOrganizations(): Promise<string[]> {
  const orgIds: string[] = [];
  for (const name of ORG_NAMES) {
    const orgId = id(`org-${name}`);
    const domain = name.toLowerCase().replace(/[^a-z]/g, '') + '.de';
    await prisma.organization.upsert({
      where: { id: orgId },
      update: { name, domain },
      create: {
        id: orgId,
        name,
        domain,
        industry: faker.company.buzzNoun(),
        employeeCount: faker.number.int({ min: 10, max: 5000 }),
        revenue: faker.helpers.arrayElement(['<1M', '1-10M', '10-50M', '50-100M', '>100M']),
        website: `https://${domain}`,
        description: faker.company.catchPhrase(),
      },
    });
    orgIds.push(orgId);
  }
  return orgIds;
}

async function seedPersons(orgIds: string[], salesId: string): Promise<string[]> {
  const personIds: string[] = [];
  for (let i = 0; i < 20; i++) {
    const personId = id(`person-${i}`);
    const orgId = orgIds[i % orgIds.length];
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const optedIn = i % 3 === 0;

    await prisma.person.upsert({
      where: { id: personId },
      update: { firstName, lastName, orgId },
      create: {
        id: personId,
        firstName,
        lastName,
        orgId,
        ownerId: salesId,
        emails: [faker.internet.email({ firstName, lastName }).toLowerCase()],
        phones: [faker.phone.number()],
        notes: faker.lorem.sentence(),
        optIn: optedIn,
        optInSource: optedIn ? 'web-form' : null,
        optInAt: optedIn ? now : null,
      },
    });
    personIds.push(personId);
  }
  return personIds;
}

async function seedProducts(): Promise<string[]> {
  const productIds: string[] = [];
  for (const p of PRODUCTS) {
    const productId = id(`product-${p.code}`);
    await prisma.product.upsert({
      where: { code: p.code },
      update: { name: p.name, billingFreq: p.billingFreq, price: p.price },
      create: {
        id: productId,
        name: p.name,
        code: p.code,
        billingFreq: p.billingFreq,
        price: p.price,
        taxPct: 19,
        currency: 'EUR',
        category: 'CRM',
        unit: 'Lizenz',
      },
    });
    productIds.push(productId);
  }
  return productIds;
}

async function seedDeals(args: {
  pipelineId: string;
  stageIds: string[];
  orgIds: string[];
  personIds: string[];
  ownerIds: string[];
}): Promise<string[]> {
  const { pipelineId, stageIds, orgIds, personIds, ownerIds } = args;
  const dealIds: string[] = [];
  const perStageOrder = new Map<string, number>();
  for (let i = 0; i < 30; i++) {
    const dealId = id(`deal-${i}`);
    const stageIdx = i % stageIds.length;
    const stageId = stageIds[stageIdx]!;
    const isWon = stageIdx === stageIds.length - 1;
    const closedAt = isWon ? new Date(now.getTime() - ((i % 30) + 1) * DAY_MS) : null;
    const orderInStage = perStageOrder.get(stageId) ?? 0;
    perStageOrder.set(stageId, orderInStage + 1);

    await prisma.deal.upsert({
      where: { id: dealId },
      update: {},
      create: {
        id: dealId,
        title: `${faker.commerce.productName()} Deal`,
        value: faker.number.int({ min: 5000, max: 250000 }),
        currency: 'EUR',
        stageId,
        pipelineId,
        ownerId: ownerIds[i % ownerIds.length]!,
        orgId: orgIds[i % orgIds.length]!,
        probability: stageIdx * 15,
        rotIndicator: i % 7 === 0,
        score: Math.min(100, stageIdx * 18 + (i % 5) * 3),
        order: orderInStage,
        closingDate: new Date(now.getTime() + ((i % 30) + 7) * DAY_MS),
        closedAt,
        wonAt: isWon ? closedAt : null,
        participants: { connect: [{ id: personIds[i % personIds.length]! }] },
      },
    });
    dealIds.push(dealId);
  }
  return dealIds;
}

async function seedActivities(args: {
  dealIds: string[];
  personIds: string[];
  ownerIds: string[];
}): Promise<void> {
  const { dealIds, personIds, ownerIds } = args;
  for (let i = 0; i < 50; i++) {
    const activityId = id(`activity-${i}`);
    const linkedToDeal = i % 2 === 0;
    await prisma.activity.upsert({
      where: { id: activityId },
      update: {},
      create: {
        id: activityId,
        type: ACTIVITY_TYPES[i % ACTIVITY_TYPES.length]!,
        subject: faker.lorem.sentence(4),
        notes: faker.lorem.paragraph(),
        dueDate: dueDateFor(i),
        priority: i % 5 === 0 ? Priority.HIGH : Priority.NORMAL,
        done: i % 4 === 0,
        doneAt: i % 4 === 0 ? new Date(now.getTime() - DAY_MS) : null,
        dealId: linkedToDeal ? dealIds[i % dealIds.length]! : null,
        personId: personIds[i % personIds.length]!,
        assigneeId: ownerIds[i % ownerIds.length]!,
      },
    });
  }
}

async function seedProjectsAndTemplate(dealIds: string[]): Promise<void> {
  const templateId = id('template-standard');
  await prisma.projectTemplate.upsert({
    where: { id: templateId },
    update: { name: 'Kundenprojekt Standard', emoji: '🚀' },
    create: {
      id: templateId,
      name: 'Kundenprojekt Standard',
      emoji: '🚀',
      tasksJson: [
        { title: 'Kickoff-Meeting', relativeDueDays: 1 },
        { title: 'Anforderungsworkshop', relativeDueDays: 7 },
        { title: 'Implementierung Sprint 1', relativeDueDays: 21 },
        { title: 'Review & Abnahme', relativeDueDays: 35 },
        { title: 'Go-Live', relativeDueDays: 42 },
      ],
    },
  });

  const statuses = [ProjectStatus.KICKOFF, ProjectStatus.IMPLEMENTATION, ProjectStatus.REVIEW];
  const emojis = ['🚀', '⚙️', '📊'];

  for (let i = 0; i < 3; i++) {
    const projectId = id(`project-${i}`);
    await prisma.project.upsert({
      where: { id: projectId },
      update: {},
      create: {
        id: projectId,
        name: `${faker.company.name()} Projekt`,
        emoji: emojis[i]!,
        dealId: dealIds[i]!,
        templateId,
        status: statuses[i]!,
      },
    });

    for (let j = 0; j < 5; j++) {
      const taskId = id(`task-${i}-${j}`);
      await prisma.task.upsert({
        where: { id: taskId },
        update: {},
        create: {
          id: taskId,
          projectId,
          title: `${j + 1}. ${faker.lorem.sentence(3)}`,
          description: faker.lorem.sentence(),
          order: j,
          done: j < 2,
          doneAt: j < 2 ? new Date(now.getTime() - DAY_MS) : null,
        },
      });
    }
  }
}

async function main(): Promise<void> {
  console.log('🌱 Seeding NextGen CRM dev DB…');

  const { admin, manager, sales } = await seedUsers();
  const ownerIds = [admin, manager, sales];

  const { pipelineId, stageIds } = await seedPipelineAndStages();
  const orgIds = await seedOrganizations();
  const personIds = await seedPersons(orgIds, sales);
  await seedProducts();
  const dealIds = await seedDeals({ pipelineId, stageIds, orgIds, personIds, ownerIds });
  await seedActivities({ dealIds, personIds, ownerIds });
  await seedProjectsAndTemplate(dealIds);

  const counts = {
    users: await prisma.user.count(),
    pipelines: await prisma.pipeline.count(),
    stages: await prisma.stage.count(),
    orgs: await prisma.organization.count(),
    persons: await prisma.person.count(),
    products: await prisma.product.count(),
    deals: await prisma.deal.count(),
    activities: await prisma.activity.count(),
    projects: await prisma.project.count(),
    tasks: await prisma.task.count(),
    templates: await prisma.projectTemplate.count(),
  };
  console.log('✅ Seed complete:', counts);
  // Silence unused-warning for CampaignStatus import (re-exported for downstream callers).
  void CampaignStatus;
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
