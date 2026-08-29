import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { QueryFailedError } from 'typeorm';
import type { Repository } from 'typeorm';
import { ProjectEntity } from './project.entity.js';

export const PROJECT_REPOSITORY = Symbol('PROJECT_REPOSITORY');

export interface Project {
  id: string;
  name: string;
}

@Injectable()
export class ProjectService {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly repository: Repository<ProjectEntity>,
  ) {}

  async create(name: string): Promise<Project> {
    const project = this.repository.create({ id: randomUUID(), name });

    try {
      await this.repository.insert(project);
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
          throw new ConflictException('Project already exists');
        }
      }
      throw error;
    }

    return { id: project.id, name: project.name };
  }
}
