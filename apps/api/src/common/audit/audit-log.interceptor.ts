import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Prisma } from '@nextgen/db';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../modules/auth/decorators/current-user.decorator';
import { extractEntity, redactCapped } from './audit.util';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Persists an AuditLog row for every successful mutating request (DSGVO Art. 5/30).
 * Reuses the existing AuditLog shape (tableName/recordId/changes) — before/after are
 * stored inside `changes`. Credential-bearing auth routes are skipped and all secret
 * keys are redacted. The write is fire-and-forget so an audit failure never breaks the
 * user-facing response.
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const method = req.method;
    if (!MUTATING.has(method)) return next.handle();

    const path = this.resolvePath(req);
    // Auth flows carry passwords / 2FA codes — never audit their bodies.
    if (path.includes('/auth/')) return next.handle();

    return next.handle().pipe(
      tap((response) => {
        void this.write(req, method, path, response);
      }),
    );
  }

  private resolvePath(req: Request): string {
    const route = (req as Request & { route?: { path?: string } }).route?.path;
    return route ?? req.originalUrl ?? req.url ?? '';
  }

  private async write(
    req: Request & { user?: AuthenticatedUser },
    method: string,
    path: string,
    response: unknown,
  ): Promise<void> {
    try {
      const responseId =
        response && typeof response === 'object' && 'id' in response
          ? String((response as { id: unknown }).id)
          : undefined;
      const recordId = (req.params?.id as string | undefined) ?? responseId ?? '';

      await this.prisma.auditLog.create({
        data: {
          userId: req.user?.id ?? null,
          action: `${method} ${path}`,
          tableName: extractEntity(path),
          recordId,
          changes: {
            before: null,
            after: redactCapped(response) ?? null,
            payload: redactCapped(req.body) ?? null,
          } as Prisma.InputJsonValue,
          ipAddress: req.ip ?? null,
          userAgent: req.headers['user-agent'] ?? null,
        },
      });
    } catch (err) {
      this.logger.warn(`audit write failed for ${method} ${path}: ${String(err)}`);
    }
  }
}
