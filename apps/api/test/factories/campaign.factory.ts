import { faker } from '@faker-js/faker';
import { CampaignStatus, type Campaign } from '@nextgen/db';
import { Factory } from 'fishery';

/** `senderId` is required (FK to User) — override with a real user id when persisting. */
export const campaignFactory = Factory.define<Campaign>(() => ({
  id: faker.string.uuid(),
  name: `${faker.commerce.department()} outreach`,
  subject: faker.lorem.sentence(5),
  bodyHtml: '<p>Hello {{firstName}}</p>',
  previewText: null,
  status: CampaignStatus.DRAFT,
  scheduledAt: null,
  sentAt: null,
  senderId: faker.string.uuid(),
  totalRecipients: 0,
  openCount: 0,
  clickCount: 0,
  unsubCount: 0,
  bounceCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
}));
