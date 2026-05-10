import { describe, expect, it, beforeAll } from 'vitest';
import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = '00000000000000000000000000000000000000000000000000000000deadbeef';
  });

  it('round-trips a UTF-8 plaintext', () => {
    const svc = new EncryptionService();
    const plaintext = 'hello — Säge — 漢字 — 🚀';
    const ct = svc.encrypt(plaintext);
    expect(ct).not.toBe(plaintext);
    expect(svc.decrypt(ct)).toBe(plaintext);
  });

  it('produces a different ciphertext for the same plaintext (random IV)', () => {
    const svc = new EncryptionService();
    const a = svc.encrypt('same');
    const b = svc.encrypt('same');
    expect(a).not.toBe(b);
    expect(svc.decrypt(a)).toBe('same');
    expect(svc.decrypt(b)).toBe('same');
  });

  it('throws on tampered ciphertext', () => {
    const svc = new EncryptionService();
    const ct = svc.encrypt('top secret');
    const buf = Buffer.from(ct, 'base64');
    buf[buf.length - 1] = (buf[buf.length - 1] ?? 0) ^ 0xff;
    const tampered = buf.toString('base64');
    expect(() => svc.decrypt(tampered)).toThrow();
  });

  it('rejects invalid ENCRYPTION_KEY (not 64 hex)', () => {
    const original = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = 'too-short';
    expect(() => new EncryptionService()).toThrow();
    process.env.ENCRYPTION_KEY = original;
  });

  it('rejects too-short ciphertext', () => {
    const svc = new EncryptionService();
    expect(() => svc.decrypt('AAAA')).toThrow();
  });
});
