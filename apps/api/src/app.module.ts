import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { LoggerModule } from 'nestjs-pino';
import { AiModule } from './ai/ai.module';
import { AuditLogInterceptor } from './common/audit/audit-log.interceptor';
import { AuditModule } from './common/audit/audit.module';
import { GdprModule } from './modules/gdpr/gdpr.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { EventsModule } from './events/events.module';
import { HealthController } from './health.controller';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { ActivitiesModule } from './modules/activities/activities.module';
import { BookingModule } from './modules/booking/booking.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { DealsModule } from './modules/deals/deals.module';
import { FormsModule } from './modules/forms/forms.module';
import { LeadsModule } from './modules/leads/leads.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { ProductsModule } from './modules/products/products.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { EmailModule } from './modules/email/email.module';
import { InsightsModule } from './modules/insights/insights.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { PipelinesModule } from './modules/pipelines/pipelines.module';
import { PulseFeedModule } from './modules/pulse-feed/pulse-feed.module';
import { PublicModule } from './modules/public/public.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
      },
    }),
    ScheduleModule.forRoot(),
    // Global 100 req/min per IP. Backed by Redis so limits hold across instances
    // (falls back to in-memory when REDIS_URL is unset, e.g. local/dev).
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [{ ttl: 60_000, limit: 100 }],
        storage: process.env.REDIS_URL
          ? new ThrottlerStorageRedisService(process.env.REDIS_URL)
          : undefined,
      }),
    }),
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL ?? 'redis://localhost:6379',
      },
    }),
    PrismaModule,
    RedisModule,
    CryptoModule,
    MailModule,
    AuthModule,
    EventsModule,
    ContactsModule,
    OrganizationsModule,
    PipelinesModule,
    DealsModule,
    PulseFeedModule,
    ActivitiesModule,
    BookingModule,
    FormsModule,
    LeadsModule,
    PublicModule,
    ProductsModule,
    ProjectsModule,
    EmailModule,
    CampaignsModule,
    InsightsModule,
    AiModule,
    AuditModule,
    GdprModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditLogInterceptor },
  ],
})
export class AppModule {}
