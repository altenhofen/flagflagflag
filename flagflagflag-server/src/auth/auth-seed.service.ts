import { Injectable, OnModuleInit } from '@nestjs/common';
import { auth } from './auth.js';
import { initializeDatabase } from '../database.js';
import { DefaultUserSchema } from './schemas.js';

@Injectable()
export class AuthSeedService implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    await initializeDatabase();

    try {
      const defaultUser = DefaultUserSchema.parse({
        email: 'flag3@localhost.test',
        name: 'flag3',
        username: 'flag3',
        password: 'flag3',
      });

      await auth.api.signUpEmail({
        body: defaultUser as never,
      });
    } catch (error) {
      const status = getErrorStatus(error);
      if (status !== 400 && status !== 409 && status !== 422) {
        throw error;
      }
    }
  }
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  if ('status' in error && typeof error.status === 'number') {
    return error.status;
  }

  if ('statusCode' in error && typeof error.statusCode === 'number') {
    return error.statusCode;
  }

  return undefined;
}
