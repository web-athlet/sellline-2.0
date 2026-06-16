/**
 * Fishery test-data factories for the main Prisma entities (Session 16a, Block 2).
 *
 * Each factory's `.build(overrides?)` returns a plain object typed to the Prisma
 * model's scalar fields — suitable both as a mocked Prisma return value in unit
 * specs and (after overriding FK ids) as `data` for `prisma.<model>.create` in
 * integration specs. Relations are never auto-populated; wire them explicitly.
 */
export { userFactory } from './user.factory';
export { organizationFactory, companyFactory } from './organization.factory';
export { personFactory } from './person.factory';
export { dealFactory } from './deal.factory';
export { leadFactory } from './lead.factory';
export { activityFactory } from './activity.factory';
export { projectFactory } from './project.factory';
export { taskFactory } from './task.factory';
export { campaignFactory } from './campaign.factory';
