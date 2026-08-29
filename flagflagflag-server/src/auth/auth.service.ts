import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Repository } from 'typeorm';
import { UserEntity } from './user.entity.js';
import type { DefaultUser } from './schemas.js';

export const USER_REPOSITORY = Symbol('auth:user-repo');

interface DriverErrorShape {
  code?: string | number;
}

const UNIQUE_VIOLATIONS: Record<string, boolean> = {
  SQLITE_CONSTRAINT_UNIQUE: true,
  '23505': true,
};

export interface PublicUser {
  id: string;
  username: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: Repository<UserEntity>,
  ) {}

  async signUp(user: DefaultUser): Promise<PublicUser> {
    const digest = hashPassword(user.password);
    const [salt, hash] = digest;
    try {
      await this.users.insert({
        id: randomUUID(),
        username: user.username,
        email: user.email,
        name: user.name,
        passwordHash: `${salt}$${hash}`,
      });
      const created = await this.users.findOneBy({ username: user.username });
      return { id: created!.id, username: user.username };
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
      throw new ConflictException('The username or email is already taken.');
    }
  }

  async verify(username: string, password: string): Promise<UserEntity> {
    const user = await this.users.findOneBy({ username });
    if (!user || !verifyHash(password, user.passwordHash)) {
      throw new UnauthorizedException('Incorrect username or password.');
    }
    return user;
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.users.findOneBy({ id: userId });
    if (!user || !verifyHash(currentPassword, user.passwordHash)) {
      throw new UnauthorizedException('Incorrect password.');
    }
    const digest = hashPassword(newPassword);
    const [salt, hash] = digest;
    await this.users.update(user.id, { passwordHash: `${salt}$${hash}` });
  }
}

function hashPassword(password: string): [salt: string, hash: string] {
  const salt = randomUUID();
  return [salt, scryptSync(password, salt, 64).toString('hex')];
}

function verifyHash(password: string, stored: string): boolean {
  const [salt, hashHex] = stored.split('$');
  if (!salt || !hashHex) {
    return false;
  }
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hashHex, 'hex');
  return (
    candidate.length === expected.length && timingSafeEqual(candidate, expected)
  );
}

function isUniqueViolation(error: unknown): boolean {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('driverError' in error)
  ) {
    return false;
  }
  const driver: DriverErrorShape = (error as { driverError: unknown })
    .driverError as DriverErrorShape;
  return UNIQUE_VIOLATIONS[String(driver.code)] === true;
}
