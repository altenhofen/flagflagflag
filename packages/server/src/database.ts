import Database from 'better-sqlite3';
import { DataSource } from 'typeorm';
import { Pool } from 'pg';
import { EnvironmentEntity } from './environment/environment.entity.js';
import { FeatureFlagEntity } from './feature_flag/feature-flag.entity.js';
import { ProjectEntity } from './project/project.entity.js';
import { UserEntity } from './auth/user.entity.js';
import { SdkKeyEntity } from './sdk/sdk-key.entity.js';
import { SdkConfigVersionEntity } from './sdk/sdk-config-version.entity.js';
import { AuditEntryEntity } from './audit/audit.entity.js';
import { AuditRetentionEntity } from './audit/audit-retention.entity.js';
import { AppUserMigration20260829061530000 } from './migrations/app-user.migration.js';
import { AuditMigration20260829090000 } from './migrations/audit.migration.js';
import { EnvironmentConfigVersionMigration20260829083000000 } from './migrations/environment-config-version.migration.js';
import { FeatureFlagPercentageMigration20260829053406520 } from './migrations/feature-flag-percentage.migration.js';
import { FeatureFlagTargetingRulesMigration20260829070000000 } from './migrations/feature-flag-targeting-rules.migration.js';
import { FeatureFlagsMigration20260829053406500 } from './migrations/feature-flags.migration.js';
import { ProjectEnvironmentsMigration20260829053406510 } from './migrations/project-environments.migration.js';
import { SdkConfigVersionMigration20260829080000001 } from './migrations/sdk-config-version.migration.js';
import { SdkKeysMigration20260829080000000 } from './migrations/sdk-keys.migration.js';
const isPostgres = process.env.DATABASE_URL?.startsWith('postgres') ?? false;
const sqliteDatabase = process.env.SQLITE_DATABASE ?? './flagflagflag.sqlite';
const migrations = [
  FeatureFlagsMigration20260829053406500,
  ProjectEnvironmentsMigration20260829053406510,
  FeatureFlagPercentageMigration20260829053406520,
  AppUserMigration20260829061530000,
  FeatureFlagTargetingRulesMigration20260829070000000,
  SdkKeysMigration20260829080000000,
  SdkConfigVersionMigration20260829080000001,
  EnvironmentConfigVersionMigration20260829083000000,
  AuditMigration20260829090000,
];
export type AppDatabase = Database.Database | Pool;

export const database: AppDatabase = isPostgres
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : new Database(sqliteDatabase);

export const featureFlagDataSource = isPostgres
  ? new DataSource({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [
        UserEntity,
        ProjectEntity,
        EnvironmentEntity,
        FeatureFlagEntity,
        SdkKeyEntity,
        SdkConfigVersionEntity,
        AuditEntryEntity,
        AuditRetentionEntity,
      ],
      migrations,
      synchronize: false,
    })
  : new DataSource({
      type: 'better-sqlite3',
      database: sqliteDatabase,
      entities: [
        UserEntity,
        ProjectEntity,
        EnvironmentEntity,
        FeatureFlagEntity,
        SdkKeyEntity,
        SdkConfigVersionEntity,
        AuditEntryEntity,
        AuditRetentionEntity,
      ],
      migrations,
      synchronize: false,
    });


let initializationPromise: Promise<void> | undefined;

export function initializeDatabase(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = runDatabaseInitialization();
  }

  return initializationPromise;
}

async function runDatabaseInitialization(): Promise<void> {
  if (!featureFlagDataSource.isInitialized) {
    await featureFlagDataSource.initialize();
  }
  await featureFlagDataSource.runMigrations();
}

