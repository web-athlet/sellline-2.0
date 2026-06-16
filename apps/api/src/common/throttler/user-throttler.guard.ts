import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Throttles per authenticated user instead of per IP — used on expensive,
 * user-scoped actions (GDPR export, campaign send) so the limit can't be
 * sidestepped by rotating source IPs. Falls back to IP for unauthenticated calls.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req.user as { id?: string } | undefined;
    return user?.id ?? (req.ip as string) ?? 'anonymous';
  }
}

/** 1 request / 24h. */
export const ONCE_PER_DAY = { default: { limit: 1, ttl: 24 * 60 * 60 * 1000 } };
/** 2 requests / hour. */
export const TWICE_PER_HOUR = { default: { limit: 2, ttl: 60 * 60 * 1000 } };
