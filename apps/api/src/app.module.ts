import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
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
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
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
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
