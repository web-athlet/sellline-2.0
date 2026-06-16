import { Module } from '@nestjs/common';
import { AuditRetentionService } from './audit-retention.service';

/**
 * Houses the audit-log retention cron. The AuditLogInterceptor itself is bound
 * globally via APP_INTERCEPTOR in AppModule (PrismaService is @Global).
 */
@Module({
  providers: [AuditRetentionService],
  exports: [AuditRetentionService],
})
export class AuditModule {}
