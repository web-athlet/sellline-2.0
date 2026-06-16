import { faker } from '@faker-js/faker';
import type { Task } from '@nextgen/db';
import { Factory } from 'fishery';

/** `projectId` is required (FK to Project) — override with a real project id when persisting. */
export const taskFactory = Factory.define<Task>(({ sequence }) => ({
  id: faker.string.uuid(),
  projectId: faker.string.uuid(),
  title: faker.lorem.sentence(3),
  description: null,
  dueDate: null,
  done: false,
  doneAt: null,
  assigneeId: null,
  order: sequence,
  createdAt: new Date(),
  updatedAt: new Date(),
}));
