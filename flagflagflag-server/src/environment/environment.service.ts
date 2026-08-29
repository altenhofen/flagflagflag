import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { QueryFailedError } from 'typeorm';
import type { Repository } from 'typeorm';
import { PROJECT_REPOSITORY } from '../project/project.service.js';
import { ProjectEntity } from '../project/project.entity.js';
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
  ) {}

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

    try {
      await this.repository.insert(environment);
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

    return { id: environment.id, name: environment.name, projectId };
  }
}
