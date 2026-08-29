import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import { AuthIdentityService } from './auth-identity.service.js';
import type { AuthService } from './auth.service.js';
import type { UserEntity } from './user.entity.js';

const user = {
  id: 'user-1',
  username: 'flag3',
} as UserEntity;

function createIdentity(
  overrides: {
    verify?: AuthService['verify'];
    signAsync?: (payload: unknown) => Promise<string>;
    verifyAsync?: <T>(token: string) => Promise<T>;
  } = {},
) {
  const authService = {
    verify: overrides.verify ?? vi.fn(async () => user),
  } as unknown as AuthService;
  const jwt = {
    signAsync: overrides.signAsync ?? vi.fn(async () => 'signed-token'),
    verifyAsync:
      overrides.verifyAsync ??
      vi.fn(async () => ({
        sub: user.id,
        username: user.username,
      })),
  } as unknown as JwtService;
  return {
    identity: new AuthIdentityService(authService, jwt),
    authService,
    jwt,
  };
}

describe('AuthIdentityService', () => {
  it('verifies credentials before issuing a session token', async () => {
    const verify = vi.fn(async () => user);
    const signAsync = vi.fn(async () => 'signed-token');
    const { identity, jwt } = createIdentity({ verify, signAsync });

    await expect(identity.authenticate('flag3', 'flag3')).resolves.toEqual({
      token: 'signed-token',
      expiresAt: expect.any(String),
    });
    expect(verify).toHaveBeenCalledWith('flag3', 'flag3');
    expect(signAsync).toHaveBeenCalledWith({
      sub: 'user-1',
      username: 'flag3',
    });
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });

  it('does not issue a token when credential verification fails', async () => {
    const verify = vi.fn(async () => {
      throw new UnauthorizedException('Incorrect username or password.');
    });
    const signAsync = vi.fn(async () => 'signed-token');
    const { identity } = createIdentity({ verify, signAsync });

    await expect(identity.authenticate('flag3', 'wrong')).rejects.toThrow(
      'Incorrect username or password.',
    );
    expect(signAsync).not.toHaveBeenCalled();
  });

  it('verifies session tokens into authenticated identities', async () => {
    const { identity } = createIdentity();

    await expect(identity.authenticateToken('signed-token')).resolves.toEqual({
      sub: 'user-1',
      username: 'flag3',
    });
  });

  it('normalizes invalid session tokens to an unauthorized error', async () => {
    const verifyAsync = vi.fn(async () => {
      throw new Error('invalid');
    });
    const { identity } = createIdentity({ verifyAsync });

    await expect(identity.authenticateToken('invalid-token')).rejects.toThrow(
      'Invalid session',
    );
  });
});
