import {
  evaluateFlag,
  type EvaluationContext,
  type EvaluationResult,
  type FlagConfig,
  type SdkConfig,
} from '@flagflagflag/evaluator';

export interface FlagsClientOptions {
  sdkKey: string;
  baseUrl: string;
  refreshIntervalMs?: number;
  fetch?: typeof globalThis.fetch;
}

export class FlagsClient {
  private readonly sdkKey: string;
  private readonly url: string;
  private readonly intervalMs: number;
  private readonly request: typeof globalThis.fetch;
  private config: SdkConfig | null = null;
  private etag: string | undefined;
  private timer: ReturnType<typeof setInterval> | undefined;
  private refreshPromise: Promise<boolean> | undefined;

  constructor(options: FlagsClientOptions) {
    this.sdkKey = options.sdkKey;
    this.url = `${options.baseUrl.replace(/\/$/, '')}/sdk/v1/config`;
    this.intervalMs = options.refreshIntervalMs ?? 30000;
    this.request = options.fetch ?? globalThis.fetch;
  }

  async initialize(): Promise<void> {
    await this.refresh();
    if (!this.timer) {
      this.timer = setInterval(() => void this.refresh(), this.intervalMs);
    }
  }

  async refresh(): Promise<boolean> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.fetchConfig().finally(() => {
      this.refreshPromise = undefined;
    });
    return this.refreshPromise;
  }

  evaluate(flagKey: string, context: EvaluationContext, fallback = false): EvaluationResult {
    if (!this.config) return { value: fallback, reason: 'NO_CONFIG' };
    const flag: FlagConfig | undefined = this.config.flags[flagKey];
    if (!flag) return { value: fallback, reason: 'FLAG_NOT_FOUND' };
    return evaluateFlag(flag, context);
  }

  isEnabled(flagKey: string, context: EvaluationContext, fallback = false): boolean {
    return this.evaluate(flagKey, context, fallback).value;
  }

  close(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  private async fetchConfig(): Promise<boolean> {
    try {
      const response = await this.request(this.url, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.sdkKey}`,
          ...(this.etag ? { 'If-None-Match': this.etag } : {}),
        },
      });
      if (response.status === 304) return true;
      if (!response.ok) return false;
      const candidate: unknown = await response.json();
      if (!isSdkConfig(candidate)) return false;
      this.config = candidate;
      this.etag = response.headers.get('etag') ?? `"${candidate.version}"`;
      return true;
    } catch {
      return false;
    }
  }
}

function isSdkConfig(value: unknown): value is SdkConfig {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SdkConfig>;
  const version = candidate.version;
  return typeof version === 'number' && Number.isInteger(version) && version >= 0 &&
    typeof candidate.environment === 'string' && isFlags(candidate.flags);
}

function isFlags(value: unknown): value is Record<string, FlagConfig> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).every(isFlag);
}

function isFlag(value: unknown): value is FlagConfig {
  if (!value || typeof value !== 'object') return false;
  const flag = value as Partial<FlagConfig>;
  return typeof flag.key === 'string' && typeof flag.enabled === 'boolean' &&
    typeof flag.defaultValue === 'boolean' && Array.isArray(flag.rules) &&
    flag.rules.every((rule) => rule && typeof rule === 'object' && typeof rule.id === 'string' &&
      Number.isFinite(rule.priority) && typeof rule.result === 'boolean' && Array.isArray(rule.conditions));
}

export type { EvaluationContext, EvaluationResult, FlagConfig, SdkConfig } from '@flagflagflag/evaluator';
