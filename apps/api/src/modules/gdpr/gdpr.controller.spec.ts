import { ForbiddenException } from '@nestjs/common';
import { Role } from '@nextgen/db';
import type { Response } from 'express';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { GdprController } from './gdpr.controller';
import { GdprService } from './gdpr.service';

const serviceMock = { collectExport: vi.fn(), writeArchive: vi.fn() };
const make = () => new GdprController(serviceMock as unknown as GdprService);
const res = {} as Response;

const user = (over: Partial<AuthenticatedUser> = {}): AuthenticatedUser => ({
  id: 'u1',
  email: 'a@b.de',
  role: Role.SALES_REP,
  twoFactorEnabled: false,
  ...over,
});

describe('GdprController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMock.collectExport.mockResolvedValue({ user: { id: 'u1' } });
    serviceMock.writeArchive.mockResolvedValue(undefined);
  });

  it('lets a user export their own data', async () => {
    await make().export('u1', user(), res);
    expect(serviceMock.collectExport).toHaveBeenCalledWith('u1');
    expect(serviceMock.writeArchive).toHaveBeenCalled();
  });

  it('lets an admin export any user', async () => {
    await make().export('other', user({ role: Role.ADMIN }), res);
    expect(serviceMock.collectExport).toHaveBeenCalledWith('other');
  });

  it('forbids exporting another user as non-admin', async () => {
    await expect(make().export('other', user(), res)).rejects.toBeInstanceOf(ForbiddenException);
    expect(serviceMock.collectExport).not.toHaveBeenCalled();
  });
});
