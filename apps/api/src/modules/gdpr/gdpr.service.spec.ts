import { PassThrough } from 'node:stream';
import type { Response } from 'express';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { PrismaService } from '../../prisma/prisma.service';
import { GdprService, type GdprExportBundle } from './gdpr.service';

const prismaMock = {
  user: { findUnique: vi.fn() },
  deal: { findMany: vi.fn() },
  activity: { findMany: vi.fn() },
  email: { findMany: vi.fn() },
  task: { findMany: vi.fn() },
  project: { findMany: vi.fn() },
  person: { findMany: vi.fn() },
  organization: { findMany: vi.fn() },
  auditLog: { findMany: vi.fn() },
};
const encMock = { decrypt: vi.fn() };

const make = () =>
  new GdprService(prismaMock as unknown as PrismaService, encMock as unknown as EncryptionService);

describe('GdprService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.de',
      password: 'hash',
      twoFactorSecret: 's',
    });
    for (const m of [
      'deal',
      'activity',
      'task',
      'project',
      'person',
      'organization',
      'auditLog',
    ] as const) {
      prismaMock[m].findMany.mockResolvedValue([]);
    }
    prismaMock.email.findMany.mockResolvedValue([]);
    encMock.decrypt.mockReturnValue('plain body');
  });

  it('throws when the user does not exist', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    await expect(make().collectExport('missing')).rejects.toThrow('User not found');
  });

  it('redacts secrets from the user profile', async () => {
    const bundle = await make().collectExport('u1');
    expect(bundle.user).toMatchObject({
      id: 'u1',
      email: 'a@b.de',
      password: '[REDACTED]',
      twoFactorSecret: '[REDACTED]',
    });
  });

  it('scopes every query to the user id', async () => {
    await make().collectExport('u1');
    expect(prismaMock.deal.findMany).toHaveBeenCalledWith({
      where: { ownerId: 'u1', deletedAt: null },
    });
    expect(prismaMock.activity.findMany).toHaveBeenCalledWith({
      where: { assigneeId: 'u1', deletedAt: null },
    });
    expect(prismaMock.email.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1', deletedAt: null },
    });
    expect(prismaMock.organization.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null, persons: { some: { ownerId: 'u1' } } },
    });
  });

  it('decrypts email bodies and drops the ciphertext', async () => {
    prismaMock.email.findMany.mockResolvedValue([
      { id: 'e1', bodyEncrypted: 'cipher', subject: 'Hi' },
    ]);
    const bundle = await make().collectExport('u1');
    const email = (bundle.emails as Array<Record<string, unknown>>)[0]!;
    expect(email.body).toBe('plain body');
    expect(email.bodyEncrypted).toBeUndefined();
  });

  it('tolerates undecryptable email bodies', async () => {
    prismaMock.email.findMany.mockResolvedValue([{ id: 'e1', bodyEncrypted: 'bad' }]);
    encMock.decrypt.mockImplementation(() => {
      throw new Error('bad tag');
    });
    const bundle = await make().collectExport('u1');
    expect((bundle.emails as Array<Record<string, unknown>>)[0]!.body).toBe('');
  });

  it('writeArchive sets zip headers and finalises', async () => {
    const sink = new PassThrough();
    const setHeader = vi.fn();
    const res = Object.assign(sink, { setHeader }) as unknown as Response;
    const bundle: GdprExportBundle = {
      user: { id: 'u1' },
      contacts: { persons: [], organizations: [] },
      deals: [],
      activities: [],
      emails: [],
      tasks: [],
      projects: [],
      auditLogs: [],
    };
    sink.resume();
    await make().writeArchive(bundle, 'u1', res);
    expect(setHeader).toHaveBeenCalledWith('Content-Type', 'application/zip');
    expect(setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="gdpr-export-u1.zip"',
    );
  });
});
