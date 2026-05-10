import { authenticator } from 'otplib';
import { beforeAll, describe, expect, it } from 'vitest';
import { EncryptionService } from '../../../common/crypto/encryption.service';
import { TwoFactorService } from './two-factor.service';

describe('TwoFactorService', () => {
  let svc: TwoFactorService;

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = '00000000000000000000000000000000000000000000000000000000deadbeef';
    svc = new TwoFactorService(new EncryptionService());
  });

  it('generates a non-empty base32 secret', () => {
    const secret = svc.generateSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(secret.length).toBeGreaterThanOrEqual(16);
  });

  it('verifyToken accepts the current code', () => {
    const secret = svc.generateSecret();
    const code = authenticator.generate(secret);
    expect(svc.verifyToken(secret, code)).toBe(true);
  });

  it('verifyToken rejects a wrong code', () => {
    const secret = svc.generateSecret();
    expect(svc.verifyToken(secret, '000000')).toBe(false);
  });

  it('encryptSecret round-trips through decryptSecret', () => {
    const secret = svc.generateSecret();
    const encrypted = svc.encryptSecret(secret);
    expect(encrypted).not.toBe(secret);
    expect(svc.decryptSecret(encrypted)).toBe(secret);
  });

  it('generates a QR code data URL with otpauth URI', async () => {
    const secret = svc.generateSecret();
    const { uri, dataUrl } = await svc.generateQrCodeDataUrl('test@example.com', secret);
    expect(uri).toContain('otpauth://totp/');
    expect(uri).toContain('NextGen%20CRM');
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
  });
});
