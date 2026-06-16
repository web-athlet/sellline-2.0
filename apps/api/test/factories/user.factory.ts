import { faker } from '@faker-js/faker';
import { Role, type User } from '@nextgen/db';
import { Factory } from 'fishery';

/**
 * Builds a `User` row (scalar fields only — relations are connected explicitly
 * in integration tests). `password` is a bcrypt-shaped placeholder; specs that
 * exercise real login should hash via the auth service instead.
 */
export const userFactory = Factory.define<User>(({ sequence }) => ({
  id: faker.string.uuid(),
  email: `user-${sequence}@test.local`,
  name: faker.person.fullName(),
  role: Role.SALES_REP,
  avatarUrl: null,
  password: '$2a$12$placeholderplaceholderplaceholderplaceholderplacehol',
  passwordChangedAt: null,
  failedLoginAttempts: 0,
  lockedUntil: null,
  twoFactorSecret: null,
  twoFactorEnabled: false,
  gmailTokenEncrypted: null,
  outlookTokenEncrypted: null,
  gmailHistoryId: null,
  gmailWatchExpiresAt: null,
  outlookSubscriptionId: null,
  outlookSubscriptionExpiresAt: null,
  bookingSlug: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
}));
