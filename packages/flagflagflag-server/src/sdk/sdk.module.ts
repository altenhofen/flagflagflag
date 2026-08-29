import { Module } from '@nestjs/common';
import { initializeDatabase, featureFlagDataSource } from '../database.js';
import { FeatureFlagEntity } from '../feature_flag/feature-flag.entity.js';
import { FEATURE_FLAG_REPOSITORY } from '../feature_flag/feature-flag.service.js';
import { SdkController, SdkKeyGuard } from './sdk.controller.js';
import { SdkService } from './sdk.service.js';
import { SDK_KEY_REPOSITORY, SDK_CONFIG_VERSION_REPOSITORY } from './sdk.tokens.js';
import { SdkKeyEntity } from './sdk-key.entity.js';
import { SdkConfigVersionEntity } from './sdk-config-version.entity.js';

@Module({
  controllers: [SdkController],
  providers: [
    SdkService,
    SdkKeyGuard,
    { provide: SDK_KEY_REPOSITORY, useFactory: async () => { await initializeDatabase(); return featureFlagDataSource.getRepository(SdkKeyEntity); } },
    { provide: SDK_CONFIG_VERSION_REPOSITORY, useFactory: async () => { await initializeDatabase(); return featureFlagDataSource.getRepository(SdkConfigVersionEntity); } },
    { provide: FEATURE_FLAG_REPOSITORY, useFactory: async () => { await initializeDatabase(); return featureFlagDataSource.getRepository(FeatureFlagEntity); } },
  ],
})
export class SdkModule {}
