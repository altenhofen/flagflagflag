import { Inject, Injectable } from '@nestjs/common';
import { evaluateFlag } from '@flagflagflag/evaluator';
import type { EvaluationContext, EvaluationReason, FlagConfig } from '@flagflagflag/evaluator';
import type { Repository } from 'typeorm';
import { z } from 'zod';
import { ENVIRONMENT_REPOSITORY } from '../environment/environment.service.js';
import type { EnvironmentEntity } from '../environment/environment.entity.js';
import { FEATURE_FLAG_REPOSITORY } from '../feature_flag/feature-flag.service.js';
import type { FeatureFlagEntity } from '../feature_flag/feature-flag.entity.js';
import { PROJECT_REPOSITORY } from '../project/project.service.js';
import type { ProjectEntity } from '../project/project.entity.js';
import type { SdkConfigVersionEntity } from '../sdk/sdk-config-version.entity.js';
import type { BatchEvaluateRequest, EvaluateRequest } from './schemas.js';

const ConfigSchema = z.object({
  key: z.string().min(1), enabled: z.boolean(), defaultValue: z.boolean(),
  rollout: z.object({ percentage: z.number().int().min(0).max(100), attribute: z.string().min(1) }).strict().nullable(),
  rules: z.array(z.object({
    id: z.string().min(1), priority: z.number().finite(), result: z.boolean(),
    conditions: z.array(z.object({
      attribute: z.string().min(1),
      operator: z.enum(['equals', 'notEquals', 'in', 'notIn', 'contains', 'greaterThan', 'greaterThanOrEqual', 'lessThan', 'lessThanOrEqual']),
      value: z.union([z.string(), z.number().finite(), z.boolean(), z.array(z.string()).min(1)]),
    })),
  })),
});

type VersionRepository = Repository<SdkConfigVersionEntity>;
export const RUNTIME_CONFIG_VERSION_REPOSITORY = Symbol('RUNTIME_CONFIG_VERSION_REPOSITORY');

export interface RuntimeEvaluationResult { flagKey: string; value: boolean; reason: EvaluationReason; matchedRuleId: string | null; configVersion: number; }

@Injectable()
export class RuntimeEvaluationService {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projects: Repository<ProjectEntity>,
    @Inject(ENVIRONMENT_REPOSITORY) private readonly environments: Repository<EnvironmentEntity>,
    @Inject(FEATURE_FLAG_REPOSITORY) private readonly flags: Repository<FeatureFlagEntity>,
    @Inject(RUNTIME_CONFIG_VERSION_REPOSITORY) private readonly versions: VersionRepository,
  ) {}

  async evaluate(request: EvaluateRequest): Promise<RuntimeEvaluationResult> {
    const resolved = await this.resolve(request.projectId, request.environmentId);
    if (!resolved) return this.fallback(request.flagKey, request.fallback, 'NO_CONFIG', 0);
    const flag = resolved.flags.find((candidate) => candidate.key === request.flagKey);
    if (!flag) return this.fallback(request.flagKey, request.fallback, 'FLAG_NOT_FOUND', resolved.configVersion);
    const config = this.toConfig(flag);
    if (!config) return this.fallback(request.flagKey, request.fallback, 'NO_CONFIG', resolved.configVersion);
    const result = evaluateFlag(config, request.context as EvaluationContext, request.environmentId);
    return { flagKey: request.flagKey, value: result.value, reason: result.reason, matchedRuleId: result.matchedRuleId ?? null, configVersion: resolved.configVersion };
  }

  async evaluateBatch(request: BatchEvaluateRequest): Promise<RuntimeEvaluationResult[]> {
    const resolved = await this.resolve(request.projectId, request.environmentId);
    if (!resolved) return request.flags.map((key) => this.fallback(key, request.fallback, 'NO_CONFIG', 0));
    const byKey = new Map(resolved.flags.map((flag) => [flag.key, flag]));
    return request.flags.map((flagKey) => {
      const flag = byKey.get(flagKey);
      if (!flag) return this.fallback(flagKey, request.fallback, 'FLAG_NOT_FOUND', resolved.configVersion);
      const config = this.toConfig(flag);
      if (!config) return this.fallback(flagKey, request.fallback, 'NO_CONFIG', resolved.configVersion);
      const result = evaluateFlag(config, request.context as EvaluationContext, request.environmentId);
      return { flagKey, value: result.value, reason: result.reason, matchedRuleId: result.matchedRuleId ?? null, configVersion: resolved.configVersion };
    });
  }

  private async resolve(projectId: string, environmentId: string) {
    if (!(await this.projects.findOneBy({ id: projectId }))) return null;
    const environment = await this.environments.findOneBy({ id: environmentId, projectId });
    if (!environment) return null;
    const [flags, version] = await Promise.all([this.flags.find({ where: { environmentId } }), this.versions.findOneBy({ environmentId })]);
    return { environment, flags, configVersion: version?.version ?? 0 };
  }

  private toConfig(flag: FeatureFlagEntity): FlagConfig | null {
    const parsed = ConfigSchema.safeParse({ key: flag.key, enabled: flag.enabled, defaultValue: flag.defaultValue, rollout: flag.rollout, rules: flag.rules });
    return parsed.success ? (parsed.data as FlagConfig) : null;
  }

  private fallback(flagKey: string, value: boolean, reason: 'FLAG_NOT_FOUND' | 'NO_CONFIG', configVersion: number): RuntimeEvaluationResult {
    return { flagKey, value, reason, matchedRuleId: null, configVersion };
  }
}
