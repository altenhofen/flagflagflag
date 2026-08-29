import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

  async list(): Promise<Project[]> {
    const projects = await this.repository.find({ order: { name: 'ASC' } });
    return projects.map(({ id, name }) => ({ id, name }));
  }

  async get(id: string): Promise<Project> {
    const project = await this.repository.findOneBy({ id });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return { id: project.id, name: project.name };
  }

  async create(name: string): Promise<Project> {
    const project = this.repository.create({ id: randomUUID(), name });
    await this.insert(project);
    return { id: project.id, name: project.name };
  }

  async update(id: string, name: string): Promise<Project> {
    const project = await this.repository.findOneBy({ id });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    project.name = name;
    await this.insert(project, true);
    return { id: project.id, name: project.name };
  }

  async remove(id: string): Promise<void> {
    const project = await this.repository.findOneBy({ id });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    await this.repository.remove(project);
  }

  private async insert(project: ProjectEntity, updating = false): Promise<void> {
    try {
      if (updating) {
        await this.repository.save(project);
      } else {
        await this.repository.insert(project);
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
          throw new ConflictException('Project already exists');
        }
      }
      throw error;
    }
  }
}
