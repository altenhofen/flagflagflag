import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { auth } from './auth/auth.js';
import { AuthSeedService } from './auth/auth-seed.service.js';
import { EnvironmentController } from './environment/environment.controller.js';
import { EnvironmentEntity } from './environment/environment.entity.js';
import {
  ENVIRONMENT_REPOSITORY,
  EnvironmentService,
} from './environment/environment.service.js';
import {
  featureFlagDataSource,
  initializeDatabase,
} from './database.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { FeatureFlagController } from './feature_flag/feature-flag.controller.js';
import { FeatureFlagEntity } from './feature_flag/feature-flag.entity.js';
import {
  FEATURE_FLAG_REPOSITORY,
  FeatureFlagService,
} from './feature_flag/feature-flag.service.js';
import { ProjectController } from './project/project.controller.js';
import { ProjectEntity } from './project/project.entity.js';
import {
  PROJECT_REPOSITORY,
  ProjectService,
} from './project/project.service.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();


@Module({
  imports: [
    AuthModule.forRoot({ auth }),
    ObserveModule.forRoot({
      appKey: 'YOUR_APP_KEY',
      appSecret: 'YOUR_APP_SECRET',
      serviceId: 'flagflagflag-server',
    }),
  ],
  controllers: [
    AppController,
    EnvironmentController,
    FeatureFlagController,
    ProjectController,
  ],
  providers: [
    {
      provide: PROJECT_REPOSITORY,
      useFactory: async () => {
        await initializeDatabase();
        return featureFlagDataSource.getRepository(ProjectEntity);
      },
    },
    {
      provide: ENVIRONMENT_REPOSITORY,
      useFactory: async () => {
        await initializeDatabase();
        return featureFlagDataSource.getRepository(EnvironmentEntity);
      },
    },
    {
      provide: FEATURE_FLAG_REPOSITORY,
      useFactory: async () => {
        await initializeDatabase();
        return featureFlagDataSource.getRepository(FeatureFlagEntity);
      },
    },
    AppService,
    EnvironmentService,
    FeatureFlagService,
    ProjectService,
    AuthSeedService,
  ],
})
export class AppModule {}