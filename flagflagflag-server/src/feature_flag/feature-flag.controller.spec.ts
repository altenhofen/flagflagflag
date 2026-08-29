import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { EnvironmentEntity } from '../environment/environment.entity.js';
import { FeatureFlagController } from './feature-flag.controller.js';
import { FeatureFlagEntity } from './feature-flag.entity.js';
import {
  FEATURE_FLAG_REPOSITORY,
  FeatureFlagService,
} from './feature-flag.service.js';
import { ENVIRONMENT_REPOSITORY } from '../environment/environment.service.js';
import { ProjectEntity } from '../project/project.entity.js';

describe('FeatureFlagController', () => {
  let controller: FeatureFlagController;
  let service: FeatureFlagService;
  let dataSource: DataSource;

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [ProjectEntity, EnvironmentEntity, FeatureFlagEntity],
      synchronize: true,
    });
    await dataSource.initialize();
    await dataSource.getRepository(ProjectEntity).insert({
      id: 'default',
      name: 'default',
    });
    await dataSource.getRepository(EnvironmentEntity).insert([
      { id: 'default-development', name: 'development', projectId: 'default' },
      { id: 'default-production', name: 'production', projectId: 'default' },
      { id: 'default-staging', name: 'staging', projectId: 'default' },
      { id: 'default-qa', name: 'qa', projectId: 'default' },
    ]);

    const app: TestingModule = await Test.createTestingModule({
      controllers: [FeatureFlagController],
      providers: [
        {
          provide: FEATURE_FLAG_REPOSITORY,
          useValue: dataSource.getRepository(FeatureFlagEntity),
        },
        {
          provide: ENVIRONMENT_REPOSITORY,
          useValue: dataSource.getRepository(EnvironmentEntity),
        },
        FeatureFlagService,
      ],
    }).compile();

    controller = app.get<FeatureFlagController>(FeatureFlagController);
    service = app.get<FeatureFlagService>(FeatureFlagService);
  });

  it('returns false for an unknown feature flag', async () => {
    await expect(
      controller.get('missing', {
        projectId: 'default',
        environment: 'development',
      }),
    ).resolves.toEqual({ enabled: false });
  });

  it('isolates flag state by environment', async () => {
    await service.setEnabled(
      'new-checkout',
      true,
      'staging',
      'default',
    );

    await expect(
      controller.get('new-checkout', {
        projectId: 'default',
        environment: 'development',
      }),
    ).resolves.toEqual({ enabled: false });
    await expect(
      controller.get('new-checkout', {
        projectId: 'default',
        environment: 'staging',
      }),
    ).resolves.toEqual({ enabled: true });
  });

  it('creates a flag in its requested environment', async () => {
    await expect(
      controller.create({
        name: 'new-nav',
        enabled: false,
        projectId: 'default',
        environment: 'development',
      }),
    ).resolves.toEqual({
      name: 'new-nav',
      projectId: 'default',
      environment: 'development',
      enabled: false,
    });
  });

  it('allows the same flag name in separate environments', async () => {
    await controller.create({
      name: 'new-nav',
      enabled: false,
      projectId: 'default',
      environment: 'development',
    });
    await expect(
      controller.create({
        name: 'new-nav',
        enabled: true,
        projectId: 'default',
        environment: 'production',
      }),
    ).resolves.toEqual({
      name: 'new-nav',
      projectId: 'default',
      environment: 'production',
      enabled: true,
    });
  });

  it('supports custom environments stored in the database', async () => {
    await expect(
      controller.create({
        name: 'new-nav',
        enabled: true,
        projectId: 'default',
        environment: 'qa',
      }),
    ).resolves.toEqual({
      name: 'new-nav',
      projectId: 'default',
      environment: 'qa',
      enabled: true,
    });
  });

  it('lists, updates, and deletes a feature flag', async () => {
    const context = { projectId: 'default', environment: 'development' };
    const created = await controller.create({
      ...context,
      name: 'lifecycle',
      enabled: false,
    });

    await expect(controller.list(context)).resolves.toEqual([created]);
    await expect(
      controller.update('lifecycle', context, { enabled: true }),
    ).resolves.toEqual({ ...created, enabled: true });
    await expect(controller.get('lifecycle', context)).resolves.toEqual({
      enabled: true,
    });

    await expect(controller.remove('lifecycle', context)).resolves.toBeUndefined();
    await expect(controller.list(context)).resolves.toEqual([]);
  });

  it('rejects malformed flag creation requests', async () => {
    await expect(
      controller.create({ name: '', enabled: true }),
    ).rejects.toThrow();
  });

  it('requires project and environment context', async () => {
    await expect(
      controller.get('new-nav', {}),
    ).rejects.toThrow();
    await expect(
      controller.create({ name: 'new-nav', enabled: true }),
    ).rejects.toThrow();
  });

  it('returns false for an unknown environment', async () => {
    await expect(
      controller.get('new-nav', {
        projectId: 'default',
        environment: 'preview',
      }),
    ).resolves.toEqual({ enabled: false });
    await expect(
      controller.create({
        name: 'new-nav',
        enabled: true,
        projectId: 'default',
        environment: 'preview',
      }),
    ).rejects.toThrow('Environment not found');
  });

  afterEach(async () => {
    await dataSource.destroy();
  });
});