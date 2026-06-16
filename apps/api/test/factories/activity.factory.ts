import { faker } from '@faker-js/faker';
import { ActivityType, Priority, type Activity } from '@nextgen/db';
import { Factory } from 'fishery';

/** `assigneeId` is required (FK to User) — override with a real user id when persisting. */
export const activityFactory = Factory.define<Activity>(() => ({
  id: faker.string.uuid(),
  type: ActivityType.CALL,
  subject: faker.lorem.sentence(4),
  notes: null,
  dueDate: faker.date.soon(),
  startTime: null,
  endTime: null,
  done: false,
  doneAt: null,
  priority: Priority.NORMAL,
  dealId: null,
  personId: null,
  orgId: null,
  assigneeId: faker.string.uuid(),
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
}));
