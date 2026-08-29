import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { ProjectController } from './project.controller.js';
import { ProjectEntity } from './project.entity.js';
import { PROJECT_REPOSITORY, ProjectService } from './project.service.js';
import { EnvironmentEntity } from '../environment/environment.entity.js';

describe('ProjectController', () => {
  let controller: ProjectController;
  let dataSource: DataSource;

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [ProjectEntity, EnvironmentEntity],
      synchronize: true,
    });
    await dataSource.initialize();

    const app: TestingModule = await Test.createTestingModule({
      controllers: [ProjectController],
      providers: [
        {
          provide: PROJECT_REPOSITORY,
          useValue: dataSource.getRepository(ProjectEntity),
        },
        ProjectService,
      ],
    }).compile();

    controller = app.get<ProjectController>(ProjectController);
  });

  it('creates a project with a generated identifier', async () => {
    const project = await controller.create({ name: 'Payments' });

    expect(project).toMatchObject({ name: 'Payments' });
    expect(project.id).toEqual(expect.any(String));
  });

  it('lists, updates, and deletes a project', async () => {
    const created = await controller.create({ name: 'Payments' });

    await expect(controller.list()).resolves.toEqual([created]);
    await expect(
      controller.update(created.id, { name: 'Billing' }),
    ).resolves.toEqual({ id: created.id, name: 'Billing' });
    await expect(controller.get(created.id)).resolves.toEqual({
      id: created.id,
      name: 'Billing',
    });

    await expect(controller.remove(created.id)).resolves.toBeUndefined();
    await expect(controller.get(created.id)).rejects.toThrow('Project not found');
  });

  it('rejects malformed project requests', async () => {
    await expect(controller.create({ name: '' })).rejects.toThrow();
  });

  afterEach(async () => {
    await dataSource.destroy();
  });
});
