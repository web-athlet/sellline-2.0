import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { EventsModule } from './events/events.module';
import { HealthController } from './health.controller';

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
    EventsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
