import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { QueryFailedError } from 'typeorm';
import type { Repository } from 'typeorm';
import { ConfigEventService } from '../sdk/config-events.js';
import { ProjectEntity } from '../project/project.entity.js';
import { PROJECT_REPOSITORY } from '../project/project.service.js';
import { EnvironmentEntity } from './environment.entity.js';
export const ENVIRONMENT_REPOSITORY = Symbol('ENVIRONMENT_REPOSITORY');

export interface Environment {
  id: string;
  name: string;
  projectId: string;
}

@Injectable()
export class EnvironmentService {
  constructor(
    @Inject(ENVIRONMENT_REPOSITORY)
    private readonly repository: Repository<EnvironmentEntity>,
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: Repository<ProjectEntity>,
    @Optional() private readonly configEvents?: ConfigEventService,
  ) {}

  async list(projectId: string): Promise<Environment[]> {
    const environments = await this.repository.find({
      where: { projectId },
      order: { name: 'ASC' },
    });
    return environments.map(({ id, name }) => ({ id, name, projectId }));
  }

  async get(projectId: string, id: string): Promise<Environment> {
    const environment = await this.repository.findOneBy({ id, projectId });
    if (!environment) {
      throw new NotFoundException('Environment not found');
    }
    return { id: environment.id, name: environment.name, projectId };
  }

  async create(projectId: string, name: string): Promise<Environment> {
    const project = await this.projectRepository.findOneBy({ id: projectId });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const environment = this.repository.create({
      id: randomUUID(),
      name,
      projectId,
    });
    await this.persist(environment);
    return { id: environment.id, name: environment.name, projectId };
  }

  async update(
    projectId: string,
    id: string,
    name?: string,
  ): Promise<Environment> {
    const environment = await this.repository.findOneBy({ id, projectId });
    if (!environment) throw new NotFoundException('Environment not found');
    const changed = name !== undefined && name !== environment.name;
    if (name !== undefined) environment.name = name;
    let version: number | undefined;
    if (changed) {
      version = await this.repository.manager.transaction(async (tx) => {
        await tx.save(EnvironmentEntity, environment);
        await tx.increment(EnvironmentEntity, { id }, 'configVersion', 1);
        const current = await tx.findOneBy(EnvironmentEntity, { id });
        if (!current) throw new NotFoundException('Environment not found');
        return current.configVersion;
      });
      this.configEvents?.publish({ environmentId: id, version });
    } else {
      await this.persist(environment, true);
    }
    return { id: environment.id, name: environment.name, projectId };
  }

  async remove(projectId: string, id: string): Promise<void> {
    const environment = await this.repository.findOneBy({ id, projectId });
    if (!environment) {
      throw new NotFoundException('Environment not found');
    }
    await this.repository.remove(environment);
  }

  private async persist(
    environment: EnvironmentEntity,
    updating = false,
  ): Promise<void> {
    try {
      if (updating) {
        await this.repository.save(environment);
      } else {
        await this.repository.insert(environment);
      }
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const driverError = error.driverError;
        const code =
          typeof driverError === 'object' &&
          driverError !== null &&
          'code' in driverError
            ? driverError.code
            : undefined;
        if (
          typeof code === 'string' &&
          (code === '23505' || code.startsWith('SQLITE_CONSTRAINT'))
        ) {
          throw new ConflictException('Environment already exists');
        }
      }
      throw error;
    }
  }
}