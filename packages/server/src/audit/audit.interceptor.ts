import { Injectable } from '@nestjs/common';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { from, type Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { AuditService } from './audit.service.js';

interface AuthRequest extends Request { user?: { sub: string } }

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    if (!['POST', 'PATCH', 'DELETE'].includes(request.method)) return next.handle();
    return next.handle().pipe(
      mergeMap((response: unknown) => from(this.record(request, response)).pipe(mergeMap(() => [response]))),
    );
  }

  private async record(request: AuthRequest, response: unknown): Promise<void> {
    const parts = request.path.split('/').filter(Boolean);
    const projectIndex = parts.indexOf('projects');
    const projectId = projectIndex >= 0 ? parts[projectIndex + 1] : undefined;
    const projectResponse = response && typeof response === 'object' ? response as Record<string, unknown> : undefined;
    const resolvedProject = projectId ?? (typeof projectResponse?.id === 'string' ? projectResponse.id : undefined);
    if (!resolvedProject || !request.user?.sub) return;
    const environmentIndex = parts.indexOf('environments');
    const environmentId = environmentIndex >= 0 ? parts[environmentIndex + 1] : undefined;
    const resourceType = resourceTypeFor(parts);
    const resourceId = parts.at(-1) === resourceType ? resolvedProject : (parts.at(-1) ?? resolvedProject);
    const action = `${request.method.toLowerCase()}.${actionFor(request.method, parts)}`;
    const body = request.body && typeof request.body === 'object' ? request.body as Record<string, unknown> : null;
    await this.audit.record({
      projectId: resolvedProject,
      actorId: request.user.sub,
      action,
      resourceType,
      resourceId,
      environmentId,
      summary: `${action} ${resourceType}`,
      after: request.method === 'DELETE' ? null : body,
    });
  }
}

function resourceTypeFor(parts: string[]): string {
  if (parts.includes('sdk-keys')) return 'sdk-key';
  if (parts.includes('flags')) return 'feature-flag';
  if (parts.includes('environments')) return 'environment';
  if (parts.includes('audit-retention')) return 'audit-retention';
  return 'project';
}

function actionFor(method: string, parts: string[]): string {
  if (parts.includes('sdk-keys') && method === 'DELETE') return 'revoke';
  return method === 'POST' ? 'create' : method === 'PATCH' ? 'update' : 'delete';
}
