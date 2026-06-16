import { faker } from '@faker-js/faker';
import type { Person } from '@nextgen/db';
import { Factory } from 'fishery';

export const personFactory = Factory.define<Person>(({ sequence }) => ({
  id: faker.string.uuid(),
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  emails: [`person-${sequence}@test.local`],
  phones: [faker.phone.number()],
  orgId: null,
  ownerId: null,
  notes: null,
  optIn: true,
  optInSource: 'factory',
  optInAt: new Date(),
  optOutAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
}));
