import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { PwnedPasswordService } from './pwned-password.service';

const sha1Upper = (s: string) => createHash('sha1').update(s).digest('hex').toUpperCase();
const resp = (ok: boolean, body: string) => ({ ok, text: async () => body }) as unknown as Response;

describe('PwnedPasswordService', () => {
  const svc = new PwnedPasswordService();

  beforeEach(() => {
    delete process.env.HIBP_CHECK_ENABLED;
    vi.restoreAllMocks();
  });

  it('is disabled by default and performs no network call', async () => {
    const f = vi.spyOn(globalThis, 'fetch');
    expect(await svc.isPwned('password123')).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });

  it('detects a breached password via the k-anonymity suffix match', async () => {
    process.env.HIBP_CHECK_ENABLED = 'true';
    const suffix = sha1Upper('password123').slice(5);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(resp(true, `${suffix}:42\r\nAAAAA:1`));
    expect(await svc.isPwned('password123')).toBe(true);
  });

  it('returns false when the suffix is not in the range response', async () => {
    process.env.HIBP_CHECK_ENABLED = 'true';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(resp(true, '0000DEADBEEF:1'));
    expect(await svc.isPwned('Sup3rSecret!Pw')).toBe(false);
  });

  it('fails open on a non-OK response', async () => {
    process.env.HIBP_CHECK_ENABLED = 'true';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(resp(false, ''));
    expect(await svc.isPwned('x')).toBe(false);
  });

  it('fails open when the request throws', async () => {
    process.env.HIBP_CHECK_ENABLED = 'true';
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));
    expect(await svc.isPwned('x')).toBe(false);
  });

  it('assertNotPwned throws BadRequest for a breached password', async () => {
    process.env.HIBP_CHECK_ENABLED = 'true';
    const suffix = sha1Upper('password123').slice(5);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(resp(true, `${suffix}:5`));
    await expect(svc.assertNotPwned('password123')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('assertNotPwned resolves silently when disabled', async () => {
    await expect(svc.assertNotPwned('anything')).resolves.toBeUndefined();
  });
});
