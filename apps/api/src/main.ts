import 'reflect-metadata';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { doubleCsrfProtection } from './common/csrf/csrf.config';

const PORT = Number(process.env.PORT ?? 3001);
const WEB_ORIGIN = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.use(cookieParser());
  // CSRF double-submit cookie (ADR-0003). Runs after cookieParser; skips GET/HEAD/
  // OPTIONS, Bearer-auth API calls and public/auth-bootstrap routes (see csrf.config).
  app.use(doubleCsrfProtection);
  app.enableCors({ origin: WEB_ORIGIN, credentials: true });
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  await app.listen(PORT);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
