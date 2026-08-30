import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_ANONYMOUS_KEY } from './allow-anonymous.decorator.js';
import { SESSION_COOKIE } from './tokens.js';
import type { JwtPayload } from './auth-identity.service.js';
import { AuthIdentityService } from './auth-identity.service.js';

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly identity: AuthIdentityService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isAnonymous = this.reflector.getAllAndOverride<boolean>(
      IS_ANONYMOUS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isAnonymous) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    request.user = await this.identity.authenticateToken(token);
    return true;
  }
}

function extractToken(request: Request): string | undefined {
  const [scheme, credential] = request.headers.authorization?.split(' ') ?? [];
  if (scheme === 'Bearer' && credential) {
    return credential;
  }

  const cookie = request.headers.cookie;
  if (!cookie) {
    return undefined;
  }
  for (const pair of cookie.split(';')) {
    const separator = pair.indexOf('=');
    if (separator > 0 && pair.slice(0, separator).trim() === SESSION_COOKIE) {
      return decodeURIComponent(pair.slice(separator + 1).trim());
    }
  }
  return undefined;
}
