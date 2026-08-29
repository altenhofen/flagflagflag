export type FeatureFlagEnvironment = string;

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

  async isEnabled(name: string): Promise<boolean> {
    if (!name) {
      return false;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/feature-flags/${encodeURIComponent(name)}?projectId=${encodeURIComponent(this.projectId)}&environment=${encodeURIComponent(this.environment)}`,
        {
          headers: {
            Accept: 'application/json',
            'X-API-Key': this.apiKey,
          },
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
