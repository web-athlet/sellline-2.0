export * from '@prisma/client';

import { PrismaClient } from '@prisma/client';

let _prisma: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (!_prisma) _prisma = new PrismaClient();
  return _prisma;
}

export const DB_PACKAGE_VERSION = '0.1.0';
