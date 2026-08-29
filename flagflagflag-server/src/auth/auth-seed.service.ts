import { Injectable } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { DefaultUserSchema } from './schemas.js';

@Injectable()
export class AuthSeedService {
  constructor(private readonly authService: AuthService) {}

  async onModuleInit(): Promise<void> {
    const defaultUser = DefaultUserSchema.parse({
      username: 'flag3',
      email: 'flag3@localhost.test',
      name: 'flag3',
      password: 'flag3',
    });
    this.authService.signUp(defaultUser).catch(() => undefined);
  }
}
