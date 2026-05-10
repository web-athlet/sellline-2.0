import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_HEX_LENGTH = 64;

@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor() {
    const raw = process.env.ENCRYPTION_KEY;
    if (!raw) {
      throw new Error('ENCRYPTION_KEY env var is required (64 hex chars = 32 bytes)');
    }
    if (raw.length !== KEY_HEX_LENGTH || !/^[0-9a-f]+$/i.test(raw)) {
      throw new Error('ENCRYPTION_KEY must be exactly 64 lowercase hex chars');
    }
    this.key = Buffer.from(raw, 'hex');
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, ciphertext]).toString('base64');
  }

  decrypt(payload: string): string {
    const buf = Buffer.from(payload, 'base64');
    if (buf.length < IV_LENGTH + TAG_LENGTH + 1) {
      throw new Error('Invalid ciphertext: payload too short');
    }
    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }
}
