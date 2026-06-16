import { faker } from '@faker-js/faker';
import type { Organization } from '@nextgen/db';
import { Factory } from 'fishery';

/**
 * Builds an `Organization` (the schema entity the v3 playbook calls "Company").
 * The `enrichmentEmbedding` pgvector column is `Unsupported(...)` and therefore
 * absent from the Prisma client type — it is never set via the factory.
 */
export const organizationFactory = Factory.define<Organization>(({ sequence }) => ({
  id: faker.string.uuid(),
  name: faker.company.name(),
  domain: `org-${sequence}.test.local`,
  parentOrgId: null,
  revenue: null,
  employeeCount: faker.number.int({ min: 1, max: 5000 }),
  industry: faker.helpers.arrayElement(['SaaS', 'Manufacturing', 'Retail', 'Finance']),
  linkedinUrl: null,
  website: null,
  description: null,
  enrichedAt: null,
  enrichedJson: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
}));

/** Spec-parity alias — the v3 playbook refers to organizations as "Company". */
export const companyFactory = organizationFactory;
