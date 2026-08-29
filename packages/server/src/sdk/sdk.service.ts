import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { EnvironmentEntity } from '../environment/environment.entity.js';
import { ENVIRONMENT_REPOSITORY } from '../environment/environment.service.js';
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
  createdAt: string;
}

export interface SdkKeyMetadata {
  id: string;
  prefix: string;
  environmentId: string;
  createdAt: string;
  revokedAt: string | null;
}

@Injectable()
export class SdkService {
  constructor(
    @Inject(SDK_KEY_REPOSITORY) private readonly keys: Repository<SdkKeyEntity>,
    @Inject(FEATURE_FLAG_REPOSITORY) private readonly flags: Repository<FeatureFlagEntity>,
    @Inject(SDK_CONFIG_VERSION_REPOSITORY)
    private readonly versions: Repository<SdkConfigVersionEntity>,
    @Inject(ENVIRONMENT_REPOSITORY)
    private readonly environments?: Repository<EnvironmentEntity>,
  ) {}

  async authenticate(rawKey: string): Promise<EnvironmentEntity> {
    const key = await this.keys.findOne({
      where: { keyHash: hashKey(rawKey) },
      relations: { environment: true },
    });
    if (!key || key.revokedAt) throw new UnauthorizedException('Invalid SDK key');
    return key.environment;
  }

  async listKeys(projectId: string, environmentId: string): Promise<SdkKeyMetadata[]> {
    await this.requireEnvironment(projectId, environmentId);
    const keys = await this.keys.find({
      where: { environmentId },
      order: { createdAt: 'DESC' },
    });
    return keys.map((key) => this.metadata(key));
  }

  /**
   * The raw secret is returned only from this method's creation response.
   * Callers must never persist or expose it after this point.
   */
  async createKey(environmentId: string, projectId?: string): Promise<IssuedSdkKey> {
    if (projectId) await this.requireEnvironment(projectId, environmentId);
    const secret = randomBytes(32).toString('base64url');
    const createdAt = new Date();
    const prefix = secret.slice(0, 8);
    const key = this.keys.create({
      id: randomUUID(),
      environmentId,
      prefix,
      keyHash: hashKey(secret),
      createdAt,
      revokedAt: null,
    });
    await this.keys.save(key);
    return {
      id: key.id,
      key: secret,
      prefix,
      environmentId,
      createdAt: createdAt.toISOString(),
    };
  }

  async revokeKey(projectId: string, environmentId: string, keyId: string): Promise<void> {
    await this.requireEnvironment(projectId, environmentId);
    const key = await this.keys.findOneBy({ id: keyId, environmentId });
    if (!key) throw new NotFoundException('SDK key not found');
    if (!key.revokedAt) {
      key.revokedAt = new Date();
      await this.keys.save(key);
    }
  }

  async config(environment: EnvironmentEntity): Promise<SdkConfig> {
    const rows = await this.flags.find({ where: { environmentId: environment.id }, order: { key: 'ASC' } });
    const flags = Object.fromEntries(rows.map((flag) => [flag.key, {
      key: flag.key,
      name: flag.name,
      enabled: flag.enabled,
      defaultValue: flag.defaultValue,
      rollout: flag.rollout,
      rules: flag.rules,
    }]));
    const fingerprint = JSON.stringify(flags);
    const record = await this.versions.findOneBy({ environmentId: environment.id });
    const configVersion = record?.fingerprint === fingerprint ? record.version : (record?.version ?? 0) + 1;
    if (!record || record.fingerprint !== fingerprint) {
      await this.versions.save({ environmentId: environment.id, fingerprint, version: configVersion });
    }
    return {
      schemaVersion: 1,
      configVersion,
      environment: { id: environment.id, key: environment.name },
      flags,
    };
  }

  private async requireEnvironment(projectId: string, environmentId: string): Promise<EnvironmentEntity> {
    if (!this.environments) throw new NotFoundException('Environment not found');
    const environment = await this.environments.findOneBy({ id: environmentId, projectId });
    if (!environment) throw new NotFoundException('Environment not found');
    return environment;
  }

  private metadata(key: SdkKeyEntity): SdkKeyMetadata {
    return {
      id: key.id,
      prefix: key.prefix,
      environmentId: key.environmentId,
      createdAt: key.createdAt.toISOString(),
      revokedAt: key.revokedAt?.toISOString() ?? null,
    };
  }
}

export function hashKey(key: string): string { return createHash('sha256').update(key).digest('hex'); }
