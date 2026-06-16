import { faker } from '@faker-js/faker';
import { ProjectStatus, type Project } from '@nextgen/db';
import { Factory } from 'fishery';

export const projectFactory = Factory.define<Project>(() => ({
  id: faker.string.uuid(),
  name: `${faker.commerce.productName()} rollout`,
  emoji: '🚀',
  dealId: null,
  templateId: null,
  status: ProjectStatus.KICKOFF,
  tagsJson: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
}));
