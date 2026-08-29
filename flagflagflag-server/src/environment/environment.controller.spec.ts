import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { EnvironmentController } from './environment.controller.js';
import { EnvironmentEntity } from './environment.entity.js';
import {
  ENVIRONMENT_REPOSITORY,
  EnvironmentService,
} from './environment.service.js';
import { ProjectEntity } from '../project/project.entity.js';
import { PROJECT_REPOSITORY } from '../project/project.service.js';

describe('EnvironmentController', () => {
  let controller: EnvironmentController;
  let dataSource: DataSource;

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [ProjectEntity, EnvironmentEntity],
      synchronize: true,
    });
    await dataSource.initialize();
    await dataSource.getRepository(ProjectEntity).insert({
      id: 'project-1',
      name: 'Payments',
    });

    const app: TestingModule = await Test.createTestingModule({
      controllers: [EnvironmentController],
      providers: [
        {
          provide: ENVIRONMENT_REPOSITORY,
          useValue: dataSource.getRepository(EnvironmentEntity),
        },
        {
          provide: PROJECT_REPOSITORY,
          useValue: dataSource.getRepository(ProjectEntity),
        },
        EnvironmentService,
      ],
    }).compile();

    controller = app.get<EnvironmentController>(EnvironmentController);
  });

  it('creates multiple environments in one project', async () => {
    const development = await controller.create('project-1', {
      name: 'development',
    });
    const staging = await controller.create('project-1', { name: 'staging' });

    expect(development).toMatchObject({
      name: 'development',
      projectId: 'project-1',
    });
    expect(staging).toMatchObject({
      name: 'staging',
      projectId: 'project-1',
    });
    expect(development.id).not.toBe(staging.id);
  });

  it('rejects environments for unknown projects', async () => {
    await expect(
      controller.create('missing-project', { name: 'development' }),
    ).rejects.toThrow('Project not found');
  });

  afterEach(async () => {
    await dataSource.destroy();
  });
});
