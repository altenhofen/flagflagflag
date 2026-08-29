import { describe, expect, it, vi } from 'vitest';
import { DataSource } from 'typeorm';
import { Test, TestingModule } from '@nestjs/testing';
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
    await service.setEnabled('new-checkout', true, 'staging', 'default');

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
      percentage: 100,
      rules: [],
    });
  });

  it('evaluates targeting rules against caller attributes', async () => {
    const rules = [
      { attribute: 'plan', operator: 'equals', value: 'pro' as const },
      { attribute: 'age', operator: 'greaterThan', value: 18 },
    ];
    await controller.create({
      name: 'targeted-checkout',
      enabled: true,
      projectId: 'default',
      environment: 'development',
      rules,
    });

    await expect(
      controller.evaluate('targeted-checkout', {
        projectId: 'default',
        environment: 'development',
        attributes: { plan: 'pro', age: 21 },
      }),
    ).resolves.toEqual({ enabled: true });
    await expect(
      controller.evaluate('targeted-checkout', {
        projectId: 'default',
        environment: 'development',
        attributes: { plan: 'free', age: 21 },
      }),
    ).resolves.toEqual({ enabled: false });
    await expect(
      controller.evaluate('targeted-checkout', {
        projectId: 'default',
        environment: 'development',
        attributes: { plan: 'pro' },
      }),
    ).resolves.toEqual({ enabled: false });
  });

  it('replaces targeting rules when updating a flag', async () => {
    const context = { projectId: 'default', environment: 'development' };
    await controller.create({
      ...context,
      name: 'mutable-target',
      enabled: true,
      rules: [{ attribute: 'plan', operator: 'equals', value: 'pro' }],
    });

    await expect(
      controller.update('mutable-target', context, {
        enabled: true,
        rules: [{ attribute: 'country', operator: 'in', value: ['DE'] }],
      }),
    ).resolves.toMatchObject({
      rules: [{ attribute: 'country', operator: 'in', value: ['DE'] }],
    });
  });
  it('evaluates enabled flags according to their rollout percentage', async () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.09);
    try {
      await expect(
        controller.create({
          name: 'gradual-checkout',
          enabled: true,
          percentage: 10,
          projectId: 'default',
          environment: 'development',
        }),
      ).resolves.toMatchObject({ percentage: 10, enabled: true });

      await expect(
        controller.get('gradual-checkout', {
          projectId: 'default',
          environment: 'development',
        }),
      ).resolves.toEqual({ enabled: true });

      random.mockReturnValue(0.1);
      await expect(
        controller.get('gradual-checkout', {
          projectId: 'default',
          environment: 'development',
        }),
      ).resolves.toEqual({ enabled: false });
    } finally {
      random.mockRestore();
    }
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
      percentage: 100,
      rules: [],
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
      percentage: 100,
      rules: [],
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

    await expect(
      controller.remove('lifecycle', context),
    ).resolves.toBeUndefined();
    await expect(controller.list(context)).resolves.toEqual([]);
  });

  it('rejects malformed flag creation requests', async () => {
    await expect(
      controller.create({ name: '', enabled: true }),
    ).rejects.toThrow();
  });
  it('rejects rollout percentages outside the 0 to 100 range', async () => {
    await expect(
      controller.create({
        name: 'invalid-rollout',
        enabled: true,
        percentage: 101,
        projectId: 'default',
        environment: 'development',
      }),
    ).rejects.toThrow();
  });

  it('requires project and environment context', async () => {
    await expect(controller.get('new-nav', {})).rejects.toThrow();
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
