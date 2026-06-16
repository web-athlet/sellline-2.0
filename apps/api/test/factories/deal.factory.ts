import { faker } from '@faker-js/faker';
import { Prisma, type Deal } from '@nextgen/db';
import { Factory } from 'fishery';

/**
 * Builds a `Deal`. `value` is a `Prisma.Decimal` to match the `@db.Decimal`
 * column. `stageId`/`pipelineId`/`ownerId` are placeholder UUIDs — override
 * them with real graph IDs (see `seedBaseGraph`) when persisting.
 */
export const dealFactory = Factory.define<Deal>(() => ({
  id: faker.string.uuid(),
  title: `${faker.company.buzzNoun()} deal`,
  value: new Prisma.Decimal(faker.number.int({ min: 1_000, max: 100_000 })),
  currency: 'EUR',
  stageId: faker.string.uuid(),
  pipelineId: faker.string.uuid(),
  ownerId: faker.string.uuid(),
  orgId: null,
  probability: faker.number.int({ min: 0, max: 100 }),
  rotIndicator: false,
  score: 0,
  scoreUpdatedAt: null,
  ghostingSnoozedUntil: null,
  ghostedAt: null,
  closingDate: null,
  closedAt: null,
  wonAt: null,
  lostAt: null,
  lostReason: null,
  order: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
}));
