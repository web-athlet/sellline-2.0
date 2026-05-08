import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

const PORT = Number(process.env.PORT ?? 3001);
const WEB_ORIGIN = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableCors({ origin: WEB_ORIGIN, credentials: true });
  await app.listen(PORT);
}

void bootstrap();
