import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { EnvironmentEntity } from '../environment/environment.entity.js';
import { FEATURE_FLAG_REPOSITORY } from '../feature_flag/feature-flag.service.js';
import type { FeatureFlagEntity } from '../feature_flag/feature-flag.entity.js';
import { SDK_KEY_REPOSITORY, SDK_CONFIG_VERSION_REPOSITORY } from './sdk.tokens.js';
import type { SdkKeyEntity } from './sdk-key.entity.js';
import type { SdkConfigVersionEntity } from './sdk-config-version.entity.js';
import type { SdkConfig, TargetingRuleConfig, TargetingOperator } from '@flagflagflag/evaluator';
 
export interface IssuedSdkKey {
  id: string;
  key: string;
  prefix: string;
  environmentId: string;
}


@Injectable()
export class SdkService {
  constructor(
    @Inject(SDK_KEY_REPOSITORY) private readonly keys: Repository<SdkKeyEntity>,
    @Inject(FEATURE_FLAG_REPOSITORY) private readonly flags: Repository<FeatureFlagEntity>,
    @Inject(SDK_CONFIG_VERSION_REPOSITORY)
    private readonly versions: Repository<SdkConfigVersionEntity>,
  ) {}
  async authenticate(rawKey: string): Promise<EnvironmentEntity> {
    const key = await this.keys.findOne({ where: { keyHash: hashKey(rawKey) }, relations: { environment: true } });
    if (!key || key.revokedAt) throw new UnauthorizedException('Invalid SDK key');
    return key.environment;
  }

  async createKey(environmentId: string): Promise<IssuedSdkKey> {
    const secret = randomBytes(32).toString('base64url');
    const prefix = secret.slice(0, 8);
    const key = this.keys.create({ id: randomUUID(), environmentId, prefix, keyHash: hashKey(secret), createdAt: new Date(), revokedAt: null });
    await this.keys.save(key);
    return { id: key.id, key: secret, prefix, environmentId };
  }

  async config(environment: EnvironmentEntity): Promise<SdkConfig> {
    const rows = await this.flags.find({ where: { environmentId: environment.id }, order: { name: 'ASC' } });
    const flags = Object.fromEntries(rows.map((flag) => [flag.name, {
      key: flag.name,
      enabled: flag.enabled,
      defaultValue: flag.percentage >= 100,
      ...(flag.percentage < 100 ? { rolloutPercentage: flag.percentage } : {}),
      rules: flag.rules.map((rule, index): TargetingRuleConfig => ({
        id: `${flag.name}-${index + 1}`,
        priority: index + 1,
        result: true,
        conditions: [{
          attribute: rule.attribute,
          operator: normalizeOperator(rule.operator),
          value: rule.value,
        }],
      })),
    }]));
    const fingerprint = JSON.stringify(flags);
    const record = await this.versions.findOneBy({ environmentId: environment.id });
    const version = record?.fingerprint === fingerprint ? record.version : (record?.version ?? 0) + 1;
    if (!record || record.fingerprint !== fingerprint) {
      await this.versions.save({ environmentId: environment.id, fingerprint, version });
    }
    return { version, environment: environment.name, flags };
  }
}

function normalizeOperator(operator: string): TargetingOperator {
  const names: Record<string, TargetingOperator> = {
    equals: 'equals',
    notEquals: 'not_equals',
    in: 'in',
    notIn: 'not_in',
    contains: 'contains',
    greaterThan: 'greater_than',
    lessThan: 'less_than',
  };
  return names[operator] ?? 'equals';
}

 

export function hashKey(key: string): string { return createHash('sha256').update(key).digest('hex'); }
