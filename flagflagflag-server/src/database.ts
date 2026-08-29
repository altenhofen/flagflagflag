import { readFile } from 'node:fs/promises';
import Database from 'better-sqlite3';
import { DataSource } from 'typeorm';
import { Pool } from 'pg';
import { EnvironmentEntity } from './environment/environment.entity.js';
import { FeatureFlagEntity } from './feature_flag/feature-flag.entity.js';
import { ProjectEntity } from './project/project.entity.js';

const isPostgres = process.env.DATABASE_URL?.startsWith('postgres') ?? false;
const sqliteDatabase = process.env.SQLITE_DATABASE ?? './flagflagflag.sqlite';
export type AppDatabase = Database.Database | Pool;

export const database: AppDatabase = isPostgres
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : new Database(sqliteDatabase);

export const featureFlagDataSource = isPostgres
  ? new DataSource({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [ProjectEntity, EnvironmentEntity, FeatureFlagEntity],
      synchronize: false,
    })
  : new DataSource({
      type: 'better-sqlite3',
      database: sqliteDatabase,
      entities: [ProjectEntity, EnvironmentEntity, FeatureFlagEntity],
      synchronize: false,
    });

const percentageMigrationUrl = new URL(
  '../migrations/2026-08-29T05-34-40.652Z-feature-flag-percentage.sql',
  import.meta.url,
);
const migrationUrls = [
  new URL('../migrations/2026-08-29T05-34-40.649Z.sql', import.meta.url),
  new URL('../migrations/2026-08-29T05-34-40.650Z-feature-flags.sql', import.meta.url),
  new URL(
    '../migrations/2026-08-29T05-34-40.651Z-project-environments.sql',
    import.meta.url,
  ),
  percentageMigrationUrl,
];

let initializationPromise: Promise<void> | undefined;

export function initializeDatabase(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = runDatabaseInitialization();
  }

  return initializationPromise;
}

async function runDatabaseInitialization(): Promise<void> {
  if (database instanceof Database) {
    database.exec(
      'create table if not exists "_schema_migrations" ("name" text not null primary key)',
    );
  } else {
    await database.query(
      'create table if not exists "_schema_migrations" ("name" text not null primary key)',
    );
  }

  for (const migrationUrl of migrationUrls) {
    const migrationName = migrationUrl.pathname.slice(
      migrationUrl.pathname.lastIndexOf('/') + 1,
    );
    await applyMigration(migrationName, migrationUrl);
  }

  if (!featureFlagDataSource.isInitialized) {
    await featureFlagDataSource.initialize();
  }
}

async function applyMigration(
  migrationName: string,
  migrationUrl: URL,
): Promise<void> {
  if (database instanceof Database) {
    const applied = database
      .prepare('select 1 from "_schema_migrations" where "name" = ?')
      .get(migrationName);
    if (applied) {
      return;
    }

    const schema = await readFile(migrationUrl, 'utf8');
    database.transaction(() => {
      database.exec(schema);
      database
        .prepare('insert into "_schema_migrations" ("name") values (?)')
        .run(migrationName);
    })();
    return;
  }

  const applied = await database.query(
    'select 1 from "_schema_migrations" where "name" = $1',
    [migrationName],
  );
  if (applied.rowCount) {
    return;
  }

  const schema = await readFile(migrationUrl, 'utf8');
  await database.query('begin');
  try {
    await database.query(schema);
    await database.query(
      'insert into "_schema_migrations" ("name") values ($1)',
      [migrationName],
    );
    await database.query('commit');
  } catch (error) {
    await database.query('rollback');
    throw error;
  }
}