import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthIdentityService } from './auth-identity.service.js';
import { AuthSeedService } from './auth-seed.service.js';
import { AuthService, USER_REPOSITORY } from './auth.service.js';
import { jwtSecret } from './tokens.js';
import { UserEntity } from './user.entity.js';
import { featureFlagDataSource, initializeDatabase } from '../database.js';

@Module({
  imports: [JwtModule.register({ secret: jwtSecret })],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthIdentityService,
    AuthGuard,
    { provide: APP_GUARD, useClass: AuthGuard },
    AuthSeedService,
    {
      provide: USER_REPOSITORY,
      useFactory: async () => {
        await initializeDatabase();
        return featureFlagDataSource.getRepository(UserEntity);
      },
    },
  ],
})
export class AuthModule {}
