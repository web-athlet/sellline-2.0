import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { subYears } from 'date-fns';
import { PrismaService } from '../../prisma/prisma.service';

const DEFAULT_RETENTION_YEARS = 7;

/**
 * Enforces the audit-log retention window: AuditLogs are kept 7 years
 * (DSGVO Art. 5 Abs. 1 lit. e + handelsrechtliche Aufbewahrungspflicht),
 * then purged by a daily cron. Configurable via AUDIT_RETENTION_YEARS.
 */
@Injectable()
export class AuditRetentionService {
  private readonly logger = new Logger(AuditRetentionService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 4 * * *', { timeZone: 'UTC' })
  async purgeExpiredCron(): Promise<void> {
    await this.purgeExpired();
  }

  async purgeExpired(): Promise<number> {
    const years = Number(process.env.AUDIT_RETENTION_YEARS ?? DEFAULT_RETENTION_YEARS);
    const cutoff = subYears(new Date(), Number.isFinite(years) ? years : DEFAULT_RETENTION_YEARS);
    const { count } = await this.prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    if (count > 0) {
      this.logger.log(`Purged ${count} audit log(s) older than ${years} year(s)`);
    }
    return count;
  }
}
