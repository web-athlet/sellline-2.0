import { Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';
import { EncryptionService } from '../../../common/crypto/encryption.service';

const ISSUER = 'NextGen CRM';

authenticator.options = { window: 1, step: 30 };

@Injectable()
export class TwoFactorService {
  constructor(private readonly encryption: EncryptionService) {}

  generateSecret(): string {
    return authenticator.generateSecret(20);
  }

  async generateQrCodeDataUrl(
    email: string,
    secret: string,
  ): Promise<{ uri: string; dataUrl: string }> {
    const uri = authenticator.keyuri(email, ISSUER, secret);
    const dataUrl = await qrcode.toDataURL(uri);
    return { uri, dataUrl };
  }

  verifyToken(secret: string, token: string): boolean {
    try {
      return authenticator.check(token, secret);
    } catch {
      return false;
    }
  }

  encryptSecret(secret: string): string {
    return this.encryption.encrypt(secret);
  }

  decryptSecret(encrypted: string): string {
    return this.encryption.decrypt(encrypted);
  }
}
