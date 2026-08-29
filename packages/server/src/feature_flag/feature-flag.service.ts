import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  PreconditionFailedException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import type { Repository } from 'typeorm';
import { ENVIRONMENT_REPOSITORY } from '../environment/environment.service.js';
import { EnvironmentEntity } from '../environment/environment.entity.js';
import type {
  CreateFeatureFlag,
  EvaluationAttributes,
  TargetingRule,
  Rollout,
} from './schemas.js';
import { TargetingRulesSchema } from './schemas.js';
import { FeatureFlagEvaluation } from './feature-flag-evaluation.js';
import { FeatureFlagEntity } from './feature-flag.entity.js';

export const FEATURE_FLAG_REPOSITORY = Symbol('FEATURE_FLAG_REPOSITORY');

export interface FeatureFlag {
  key: string;
  name: string;
  environmentId: string;
  enabled: boolean;
  defaultValue: boolean;
  rollout: Rollout | null;
  rules: TargetingRule[];
  version: number;
}

@Injectable()
export class FeatureFlagService {
  constructor(
    @Inject(FEATURE_FLAG_REPOSITORY)
    private readonly repository: Repository<FeatureFlagEntity>,
    @Inject(ENVIRONMENT_REPOSITORY)
    private readonly environmentRepository: Repository<EnvironmentEntity>,
  ) {}

  private readonly evaluation = new FeatureFlagEvaluation();

  async list(
    projectId: string,
    environmentId: string,
    options: { limit?: number; cursor?: string } = {},
  ): Promise<FeatureFlag[]> {
    await this.getEnvironment(projectId, environmentId);
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
    const flags = await this.repository.find({
      where: { environmentId },
      order: { key: 'ASC' },
      take: limit + 1,
      ...(options.cursor ? { skip: 1 } : {}),
    });
    return flags.slice(0, limit).map((flag) => this.toResource(flag));
  }

  async get(projectId: string, environmentId: string, key: string): Promise<FeatureFlag> {
    await this.getEnvironment(projectId, environmentId);
    const flag = await this.repository.findOneBy({ key, environmentId });
    if (!flag) throw new NotFoundException('Feature flag not found');
    return this.toResource(flag);
  }

  async create(projectId: string, environmentId: string, data: CreateFeatureFlag): Promise<FeatureFlag> {
    await this.getEnvironment(projectId, environmentId);
    const flag = this.repository.create({
      key: data.key,
      name: data.name,
      environmentId,
      enabled: data.enabled,
      defaultValue: data.defaultValue,
      rollout: data.rollout,
      rules: data.rules,
    });
    try {
      await this.repository.insert(flag);
    } catch (error) {
      if (this.isConstraintError(error)) throw new ConflictException('Feature flag already exists');
      throw error;
    }
    return this.toResource(flag);
  }

  async update(
    projectId: string,
    environmentId: string,
    key: string,
    data: Partial<Omit<CreateFeatureFlag, 'key'>>,
    expectedVersion?: number,
  ): Promise<FeatureFlag> {
    await this.getEnvironment(projectId, environmentId);
    const flag = await this.repository.findOneBy({ key, environmentId });
    if (!flag) throw new NotFoundException('Feature flag not found');
    if (expectedVersion !== undefined && flag.version !== expectedVersion) {
      throw new PreconditionFailedException('Feature flag version does not match');
    }
    if (data.name !== undefined) flag.name = data.name;
    if (data.enabled !== undefined) flag.enabled = data.enabled;
    if (data.defaultValue !== undefined) flag.defaultValue = data.defaultValue;
    if (data.rollout !== undefined) flag.rollout = data.rollout;
    if (data.rules !== undefined) flag.rules = data.rules;
    await this.repository.save(flag);
    return this.toResource(flag);
  }

  async remove(projectId: string, environmentId: string, key: string): Promise<void> {
    await this.getEnvironment(projectId, environmentId);
    const flag = await this.repository.findOneBy({ key, environmentId });
    if (!flag) throw new NotFoundException('Feature flag not found');
    await this.repository.remove(flag);
  }

  async isEnabled(
    projectId: string,
    environmentId: string,
    key: string,
    attributes: EvaluationAttributes = {},
  ): Promise<boolean> {
    const flag = await this.get(projectId, environmentId, key);
    const parsedRules = TargetingRulesSchema.safeParse(flag.rules);
    if (!parsedRules.success) return flag.defaultValue;
    return this.evaluation.evaluate(
      { key: flag.key, environmentId: flag.environmentId, enabled: flag.enabled,
        defaultValue: flag.defaultValue, rollout: flag.rollout, rules: parsedRules.data },
      attributes,
    );
  }

  private toResource(flag: FeatureFlagEntity): FeatureFlag {
    return {
      key: flag.key,
      name: flag.name,
      environmentId: flag.environmentId,
      enabled: flag.enabled,
      defaultValue: flag.defaultValue,
      rollout: flag.rollout,
      version: flag.version,
      rules: flag.rules,
    };
  }

  private async getEnvironment(projectId: string, environmentId: string): Promise<EnvironmentEntity> {
    const environment = await this.environmentRepository.findOneBy({ id: environmentId, projectId });
    if (!environment) throw new NotFoundException('Environment not found');
    return environment;
  }

  private isConstraintError(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) return false;
    const driverError = error.driverError;
    const code =
      typeof driverError === 'object' && driverError !== null && 'code' in driverError
        ? driverError.code
        : undefined;
    return typeof code === 'string' &&
      (code === '23505' || code.startsWith('SQLITE_CONSTRAINT'));
  }
}
