import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import type { Repository } from 'typeorm';
import { ENVIRONMENT_REPOSITORY } from '../environment/environment.service.js';
import { EnvironmentEntity } from '../environment/environment.entity.js';
import { FeatureFlagEntity } from './feature-flag.entity.js';

export const FEATURE_FLAG_REPOSITORY = Symbol('FEATURE_FLAG_REPOSITORY');

export interface FeatureFlag {
  name: string;
  projectId: string;
  environment: string;
  enabled: boolean;
}

@Injectable()
export class FeatureFlagService {
  constructor(
    @Inject(FEATURE_FLAG_REPOSITORY)
    private readonly repository: Repository<FeatureFlagEntity>,
    @Inject(ENVIRONMENT_REPOSITORY)
    private readonly environmentRepository: Repository<EnvironmentEntity>,
  ) {}

  async isEnabled(
    name: string,
    environmentName: string,
    projectId: string,
  ): Promise<boolean> {
    const environment = await this.environmentRepository.findOneBy({
      name: environmentName,
      projectId,
    });
    if (!environment) {
      return false;
    }

    const flag = await this.repository.findOneBy({
      name,
      environmentId: environment.id,
    });
    return flag?.enabled ?? false;
  }
  async list(
    environmentName: string,
    projectId: string,
  ): Promise<FeatureFlag[]> {
    const environment = await this.getEnvironment(projectId, environmentName);
    const flags = await this.repository.find({
      where: { environmentId: environment.id },
      order: { name: 'ASC' },
    });
    return flags.map(({ name, enabled }) => ({
      name,
      projectId,
      environment: environment.name,
      enabled,
    }));
  }

  async create(
    name: string,
    enabled: boolean,
    environmentName: string,
    projectId: string,
  ): Promise<FeatureFlag> {
    const environment = await this.getEnvironment(projectId, environmentName);

    try {
      await this.repository.insert(
        this.repository.create({
          name,
          environmentId: environment.id,
          enabled,
        }),
      );
    } catch (error) {
      const driverError =
        error instanceof QueryFailedError ? error.driverError : undefined;
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
        throw new ConflictException('Feature flag already exists');
      }
      throw error;
    }

    return {
      name,
      projectId,
      environment: environment.name,
      enabled,
    };
  }
  async update(
    name: string,
    enabled: boolean,
    environmentName: string,
    projectId: string,
  ): Promise<FeatureFlag> {
    const environment = await this.getEnvironment(projectId, environmentName);
    const flag = await this.repository.findOneBy({
      name,
      environmentId: environment.id,
    });
    if (!flag) {
      throw new NotFoundException('Feature flag not found');
    }
    flag.enabled = enabled;
    await this.repository.save(flag);
    return { name, projectId, environment: environment.name, enabled };
  }

  async remove(
    name: string,
    environmentName: string,
    projectId: string,
  ): Promise<void> {
    const environment = await this.getEnvironment(projectId, environmentName);
    const flag = await this.repository.findOneBy({
      name,
      environmentId: environment.id,
    });
    if (!flag) {
      throw new NotFoundException('Feature flag not found');
    }
    await this.repository.remove(flag);
  }

  async setEnabled(
    name: string,
    enabled: boolean,
    environmentName: string,
    projectId: string,
  ): Promise<void> {
    const environment = await this.getEnvironment(projectId, environmentName);
    await this.repository.upsert(
      { name, environmentId: environment.id, enabled },
      ['name', 'environmentId'],
    );
  }

  private async getEnvironment(
    projectId: string,
    environmentName: string,
  ): Promise<EnvironmentEntity> {
    const environment = await this.environmentRepository.findOneBy({
      name: environmentName,
      projectId,
    });
    if (!environment) {
      throw new NotFoundException('Environment not found');
    }
    return environment;
  }
}