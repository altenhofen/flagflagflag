import { describe, expect, it } from 'vitest';
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

const projectId = 'project-1';
const environmentId = 'environment-1';

const flagData = {
  key: 'new-checkout',
  name: 'New checkout',
  enabled: true,
  defaultValue: false,
  rollout: null,
  rules: [],
};

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
      id: projectId,
      name: 'Payments',
    });
    await dataSource.getRepository(EnvironmentEntity).insert({
      id: environmentId,
      name: 'staging',
      projectId,
    });

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

  it('creates a stable-key flag in its nested environment', async () => {
    await expect(
      controller.create(projectId, environmentId, flagData),
    ).resolves.toEqual({
      ...flagData,
      environmentId,
      version: 1,
    });
  });

  it('lists, updates, gets, and deletes flags in a collection envelope', async () => {
    const created = await controller.create(projectId, environmentId, flagData);

    await expect(controller.list(projectId, environmentId)).resolves.toEqual({
      data: [created],
      pagination: { nextCursor: null },
    });
    await expect(
      controller.update(projectId, environmentId, flagData.key, {
        name: 'Checkout experiment',
        enabled: false,
      }),
    ).resolves.toEqual({
      ...created,
      name: 'Checkout experiment',
      enabled: false,
      version: 2,
    });
    await expect(
      controller.get(projectId, environmentId, flagData.key),
    ).resolves.toEqual({
      ...created,
      name: 'Checkout experiment',
      enabled: false,
      version: 2,
    });

    await expect(
      controller.remove(projectId, environmentId, flagData.key),
    ).resolves.toBeUndefined();
    await expect(
      controller.get(projectId, environmentId, flagData.key),
    ).rejects.toThrow('Feature flag not found');
  });

  it('replaces targeting rules with explicit result and condition shapes', async () => {
    const created = await controller.create(projectId, environmentId, {
      ...flagData,
      key: 'targeted-checkout',
      rules: [
        {
          id: 'pro-users',
          priority: 10,
          result: true,
          conditions: [
            { attribute: 'plan', operator: 'equals', value: 'pro' },
          ],
        },
      ],
    });
    const rules = [
      {
        id: 'enterprise-users',
        priority: 1,
        result: false,
        conditions: [
          { attribute: 'plan', operator: 'equals' as const, value: 'enterprise' },
        ],
      },
    ];

    await expect(
      controller.update(projectId, environmentId, created.key, { rules }),
    ).resolves.toMatchObject({ key: created.key, rules });
  });

  it('preserves defaultValue and nullable rollout configuration', async () => {
    await expect(
      controller.create(projectId, environmentId, {
        ...flagData,
        key: 'gradual-checkout',
        defaultValue: true,
        rollout: { percentage: 25, attribute: 'userId' },
      }),
    ).resolves.toMatchObject({
      key: 'gradual-checkout',
      defaultValue: true,
      rollout: { percentage: 25, attribute: 'userId' },
    });

    await expect(
      controller.update(projectId, environmentId, 'gradual-checkout', {
        rollout: null,
      }),
    ).resolves.toMatchObject({
      defaultValue: true,
      rollout: null,
    });
  });

  it('rejects malformed keys, requests, and rollout percentages', async () => {
    await expect(
      controller.create(projectId, environmentId, {
        ...flagData,
        key: 'Not a slug',
      }),
    ).rejects.toThrow();
    await expect(
      controller.create(projectId, environmentId, {
        ...flagData,
        key: 'invalid-rollout',
        rollout: { percentage: 101, attribute: 'userId' },
      }),
    ).rejects.toThrow();
    await expect(
      controller.update(projectId, environmentId, flagData.key, {}),
    ).rejects.toThrow();
  });

  it('rejects flags for unknown projects or environments', async () => {
    await expect(
      controller.create('missing-project', environmentId, flagData),
    ).rejects.toThrow('Environment not found');
    await expect(
      controller.create(projectId, 'missing-environment', flagData),
    ).rejects.toThrow('Environment not found');
  });

  it('keeps service evaluation scoped to the nested environment', async () => {
    await service.create(projectId, environmentId, flagData);
    await expect(
      service.isEnabled(projectId, environmentId, flagData.key),
    ).resolves.toBe(false);
  });

  afterEach(async () => {
    await dataSource.destroy();
  });
});
