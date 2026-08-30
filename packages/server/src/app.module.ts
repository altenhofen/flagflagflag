import { AuditController } from './audit/audit.controller.js';
import { AuditEntryEntity } from './audit/audit.entity.js';
import { AuditInterceptor } from './audit/audit.interceptor.js';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditRetentionEntity } from './audit/audit-retention.entity.js';
import {
  AUDIT_REPOSITORY,
  AUDIT_RETENTION_REPOSITORY,
  AuditService,
} from './audit/audit.service.js';
import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { SdkModule } from './sdk/sdk.module.js';
import { AuthModule } from './auth/auth.module.js';
import { EnvironmentController } from './environment/environment.controller.js';
import { EnvironmentEntity } from './environment/environment.entity.js';
import {
  ENVIRONMENT_REPOSITORY,
  EnvironmentService,
} from './environment/environment.service.js';
import { featureFlagDataSource, initializeDatabase } from './database.js';
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
import { RuntimeEvaluationController } from './runtime-evaluation/runtime-evaluation.controller.js';
import {
  RUNTIME_CONFIG_VERSION_REPOSITORY,
  RuntimeEvaluationService,
} from './runtime-evaluation/runtime-evaluation.service.js';
import { SdkConfigVersionEntity } from './sdk/sdk-config-version.entity.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    AuthModule,
    SdkModule,
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
    RuntimeEvaluationController,
    AuditController,
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
    {
      provide: RUNTIME_CONFIG_VERSION_REPOSITORY,
      useFactory: async () => {
        await initializeDatabase();
        return featureFlagDataSource.getRepository(SdkConfigVersionEntity);
      },
    },
    {
      provide: AUDIT_REPOSITORY,
      useFactory: async () => {
        await initializeDatabase();
        return featureFlagDataSource.getRepository(AuditEntryEntity);
      },
    },
    {
      provide: AUDIT_RETENTION_REPOSITORY,
      useFactory: async () => {
        await initializeDatabase();
        return featureFlagDataSource.getRepository(AuditRetentionEntity);
      },
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
    AuditService,
    RuntimeEvaluationService,
    AppService,
    EnvironmentService,
    FeatureFlagService,
    ProjectService,
  ],
})
export class AppModule {}
