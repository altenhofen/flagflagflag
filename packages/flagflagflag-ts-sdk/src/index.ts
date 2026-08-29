export type FeatureFlagEnvironment = string;
export type EvaluationAttributes = Record<string, string | number | boolean>;

export interface FlagClientOptions {
  baseUrl: string;
  apiKey: string;
  projectId: string;
  environment: FeatureFlagEnvironment;
}

interface FlagResponse {
  enabled: boolean;
}

export class FlagClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly projectId: string;
  private readonly environment: FeatureFlagEnvironment;

  constructor(options: FlagClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.projectId = options.projectId;
    this.environment = options.environment;
  }

  async isEnabled(
    name: string,
    attributes?: EvaluationAttributes,
  ): Promise<boolean> {
    if (!name) {
      return false;
    }

    try {
      const hasAttributes = attributes !== undefined;
      const response = await fetch(
        hasAttributes
          ? `${this.baseUrl}/feature-flags/${encodeURIComponent(name)}/evaluate`
          : `${this.baseUrl}/feature-flags/${encodeURIComponent(name)}?projectId=${encodeURIComponent(this.projectId)}&environment=${encodeURIComponent(this.environment)}`,
        {
          method: hasAttributes ? 'POST' : 'GET',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-API-Key': this.apiKey,
          },
          ...(hasAttributes
            ? {
                body: JSON.stringify({
                  projectId: this.projectId,
                  environment: this.environment,
                  attributes,
                }),
              }
            : {}),
        },
      );

      if (!response.ok) {
        return false;
      }

      const body: unknown = await response.json();
      return isFlagResponse(body) && body.enabled;
    } catch {
      return false;
    }
  }
}

function isFlagResponse(value: unknown): value is FlagResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'enabled' in value &&
    typeof value.enabled === 'boolean'
  );
}
