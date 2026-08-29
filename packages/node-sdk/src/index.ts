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
  private readonly eventsUrl: string;
  private readonly intervalMs: number;
  private readonly request: typeof globalThis.fetch;
  private config: SdkConfig | null = null;
  private etag: string | undefined;
  private timer: ReturnType<typeof setInterval> | undefined;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private sseAbort: AbortController | undefined;
  private reconnectAttempt = 0;
  private closed = false;
  private refreshPromise: Promise<boolean> | undefined;

  constructor(options: FlagsClientOptions) {
    this.sdkKey = options.sdkKey;
    this.url = `${options.baseUrl.replace(/\/$/, '')}/api/v1/sdk/config`;
    this.eventsUrl = this.url.replace(/\/config$/, '/events');
    this.intervalMs = options.refreshIntervalMs ?? 300000;
    this.request = options.fetch ?? globalThis.fetch;
  }

  async initialize(): Promise<void> {
    await this.refresh();
    if (this.closed) return;
    this.connectSse();
    if (!this.timer) this.timer = setInterval(() => void this.refresh(), this.intervalMs);
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
    const flag = this.config.flags[flagKey];
    if (!flag) return { value: fallback, reason: 'FLAG_NOT_FOUND' };
    return evaluateFlag(flag, context, this.config.environment.id);
  }

  isEnabled(flagKey: string, context: EvaluationContext, fallback = false): boolean {
    return this.evaluate(flagKey, context, fallback).value;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.timer) clearInterval(this.timer);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.timer = undefined;
    this.reconnectTimer = undefined;
    this.sseAbort?.abort();
    this.sseAbort = undefined;
  }

  private connectSse(reconnect = false): void {
    if (this.closed || this.sseAbort) return;
    const controller = new AbortController();
    this.sseAbort = controller;
    void this.consumeSse(controller.signal, reconnect).then((shouldReconnect) => {
      if (this.sseAbort === controller) this.sseAbort = undefined;
      if (!this.closed && shouldReconnect) this.scheduleReconnect();
    });
  }

  private async consumeSse(signal: AbortSignal, reconnect: boolean): Promise<boolean> {
    try {
      const response = await this.request(this.eventsUrl, {
        headers: { Accept: 'text/event-stream', Authorization: `Bearer ${this.sdkKey}` },
        signal,
      });
      if (!response.ok) return true;
      if (response.headers.get('content-type')?.startsWith('text/event-stream') !== true || !response.body) {
        return false;
      }
      this.reconnectAttempt = 0;
      if (reconnect) await this.refresh();
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (!signal.aborted) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        const messages = buffer.split(/\n\n/);
        buffer = messages.pop() ?? '';
        for (const message of messages) this.handleSseMessage(message);
      }
      return !signal.aborted;
    } catch {
      return !signal.aborted;
    }
  }

  private handleSseMessage(message: string): void {
    const eventName = message.match(/^event:\s*(.+)$/m)?.[1];
    if (eventName !== 'config.updated') return;
    try {
      const data = JSON.parse(message.match(/^data:\s*(.+)$/m)?.[1] ?? '') as { version?: unknown };
      if (typeof data.version === 'number' && (!this.config || data.version > this.config.configVersion)) {
        void this.refresh();
      }
    } catch {
      // Ignore malformed invalidation messages.
    }
  }

  private scheduleReconnect(): void {
    if (this.closed || this.reconnectTimer) return;
    const base = Math.min(30000, 1000 * 2 ** this.reconnectAttempt++);
    const delay = Math.round(base * (0.8 + Math.random() * 0.4));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connectSse(true);
    }, delay);
  }

  private async fetchConfig(): Promise<boolean> {
    try {
      const response = await this.request(this.url, {
        headers: {
          Accept: 'application/json',
          'X-SDK-Key': this.sdkKey,
          ...(this.etag ? { 'If-None-Match': this.etag } : {}),
        },
      });
      if (response.status === 304) return true;
      if (!response.ok) return false;
      const candidate: unknown = await response.json();
      if (!isSdkConfig(candidate)) return false;
      this.config = candidate;
      this.etag = response.headers.get('etag') ?? `"${this.config.configVersion}"`;
      return true;
    } catch {
      return false;
    }
  }
}

function isSdkConfig(value: unknown): value is SdkConfig {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SdkConfig>;
  const configVersion = candidate.configVersion;
  const environment = candidate.environment;
  return candidate.schemaVersion === 1 && typeof configVersion === 'number' && Number.isInteger(configVersion) && configVersion >= 0 &&
    !!environment && typeof environment.id === 'string' && typeof environment.key === 'string' &&
    isFlags(candidate.flags);
}

function isFlags(value: unknown): value is Record<string, FlagConfig> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).every(isFlag);
}

function isFlag(value: unknown): value is FlagConfig {
  if (!value || typeof value !== 'object') return false;
  const flag = value as Partial<FlagConfig>;
  return typeof flag.key === 'string' && typeof flag.enabled === 'boolean' &&
    typeof flag.defaultValue === 'boolean' && (flag.rollout === null || isRollout(flag.rollout)) &&
    Array.isArray(flag.rules) && flag.rules.every(isRule);
}

function isRollout(value: unknown): boolean {
  return !!value && typeof value === 'object' && Number.isInteger((value as { percentage?: unknown }).percentage) &&
    typeof (value as { attribute?: unknown }).attribute === 'string';
}

function isRule(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const rule = value as { id?: unknown; priority?: unknown; result?: unknown; conditions?: unknown };
  return typeof rule.id === 'string' && Number.isInteger(rule.priority) && typeof rule.result === 'boolean' &&
    Array.isArray(rule.conditions) && rule.conditions.every(isCondition);
}

function isCondition(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const condition = value as { attribute?: unknown; operator?: unknown; value?: unknown };
  return typeof condition.attribute === 'string' && typeof condition.operator === 'string' && condition.value !== undefined;
}

export type { EvaluationContext, EvaluationResult, FlagConfig, SdkConfig } from '@flagflagflag/evaluator';
