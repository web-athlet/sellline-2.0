import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it('extends PrismaClient and connects/disconnects via lifecycle hooks', async () => {
    const svc = new PrismaService();
    const connectSpy = vi.spyOn(svc, '$connect').mockResolvedValue(undefined);
    const disconnectSpy = vi.spyOn(svc, '$disconnect').mockResolvedValue(undefined);
    await svc.onModuleInit();
    await svc.onModuleDestroy();
    expect(connectSpy).toHaveBeenCalledOnce();
    expect(disconnectSpy).toHaveBeenCalledOnce();
  });
});
