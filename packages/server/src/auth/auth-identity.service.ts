import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service.js';
import type { PublicUser } from './auth.service.js';
import { SESSION_TTL_MS } from './tokens.js';
import type { UserEntity } from './user.entity.js';

export interface AuthToken {
  accessToken: string;
  tokenType: 'Bearer';
  expiresAt: string;
  user: PublicUser;
}

export interface JwtPayload {
  sub: string;
  username: string;
}

@Injectable()
export class AuthIdentityService {
  constructor(
    private readonly authService: AuthService,
    private readonly jwt: JwtService,
  ) {}

  async authenticate(username: string, password: string): Promise<AuthToken> {
    const user = await this.authService.verify(username, password);
    return this.issueToken(user);
  }

  async getCurrentUser(userId: string): Promise<PublicUser> {
    return this.authService.findById(userId);
  }

  async authenticateToken(token: string): Promise<JwtPayload> {
    try {
      return await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid session');
    }
  }

  private async issueToken(user: UserEntity): Promise<AuthToken> {
    const payload: JwtPayload = { sub: user.id, username: user.username };
    return {
      accessToken: await this.jwt.signAsync(payload),
      tokenType: 'Bearer',
      expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
      },
    };
  }
}
