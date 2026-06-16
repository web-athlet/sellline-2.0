import { faker } from '@faker-js/faker';
import { EnrichmentStatus, Prisma, type Lead } from '@nextgen/db';
import { Factory } from 'fishery';

export const leadFactory = Factory.define<Lead>(({ sequence }) => ({
  id: faker.string.uuid(),
  source: 'webform',
  formId: null,
  dataJson: {
    email: `lead-${sequence}@test.local`,
    firstName: faker.person.firstName(),
    company: faker.company.name(),
  } as Prisma.JsonValue,
  enrichedJson: null,
  enrichmentStatus: EnrichmentStatus.PENDING,
  convertedDealId: null,
  companyName: faker.company.name(),
  emailDomain: `lead-${sequence}.test.local`,
  score: 0,
  scoreUpdatedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
}));
