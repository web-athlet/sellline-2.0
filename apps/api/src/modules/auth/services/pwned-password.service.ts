import { createHash } from 'node:crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';

const HIBP_RANGE_URL = 'https://api.pwnedpasswords.com/range';

/**
 * Checks passwords against the Have-I-Been-Pwned breach corpus using the
 * k-anonymity range API (only the first 5 SHA-1 chars leave the server).
 *
 * Disabled by default (HIBP_CHECK_ENABLED) so the registration/password flows
 * stay self-contained and deterministic; enable in environments with egress.
 * Fails open — an HIBP outage never blocks a legitimate password change.
 */
@Injectable()
export class PwnedPasswordService {
  private readonly logger = new Logger(PwnedPasswordService.name);

  get enabled(): boolean {
    return process.env.HIBP_CHECK_ENABLED === 'true';
  }

  async isPwned(password: string): Promise<boolean> {
    if (!this.enabled) return false;
    const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);
    try {
      const res = await fetch(`${HIBP_RANGE_URL}/${prefix}`, {
        headers: { 'Add-Padding': 'true' },
      });
      if (!res.ok) return false;
      const body = await res.text();
      return body.split('\n').some((line) => {
        const [hashSuffix, count] = line.trim().split(':');
        return hashSuffix === suffix && Number(count) > 0;
      });
    } catch (err) {
      this.logger.warn(`HIBP check failed, allowing password: ${String(err)}`);
      return false;
    }
  }

  async assertNotPwned(password: string): Promise<void> {
    if (await this.isPwned(password)) {
      throw new BadRequestException(
        'This password has appeared in a known data breach. Please choose another.',
      );
    }
  }
}
