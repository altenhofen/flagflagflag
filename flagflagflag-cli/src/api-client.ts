import { FlagClient } from '@flagflagflag/ts-sdk';

export interface Project {
  id: string;
  name: string;
}

export interface Environment {
  id: string;
  name: string;
  projectId: string;
}

export interface FeatureFlag {
  name: string;
  projectId: string;
  environment: string;
  enabled: boolean;
}

export interface FlagApi {
  createProject(name: string): Promise<Project>;
  createEnvironment(projectId: string, name: string): Promise<Environment>;
  createFlag(
    name: string,
    enabled: boolean,
    projectId: string,
    environment: string,
  ): Promise<FeatureFlag>;
  isEnabled(
    name: string,
    projectId: string,
    environment: string,
  ): Promise<boolean>;
}

export interface FlagApiClientOptions {
  baseUrl: string;
  username: string;
  password: string;
  apiKey?: string;
}

export class FlagApiClient implements FlagApi {
  private readonly baseUrl: string;
  private readonly username: string;
  private readonly password: string;
  private readonly apiKey: string;
  private cookie: string | undefined;

  constructor(options: FlagApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.username = options.username;
    this.password = options.password;
    this.apiKey = options.apiKey ?? '';
  }

  async createProject(name: string): Promise<Project> {
    return this.request('/projects', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async createEnvironment(projectId: string, name: string): Promise<Environment> {
    return this.request(`/projects/${encodeURIComponent(projectId)}/environments`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async createFlag(
    name: string,
    enabled: boolean,
    projectId: string,
    environment: string,
  ): Promise<FeatureFlag> {
    return this.request('/feature-flags', {
      method: 'POST',
      body: JSON.stringify({ name, enabled, projectId, environment }),
    });
  }

  async isEnabled(
    name: string,
    projectId: string,
    environment: string,
  ): Promise<boolean> {
    const client = new FlagClient({
      baseUrl: this.baseUrl,
      apiKey: this.apiKey,
      projectId,
      environment,
    });
    return client.isEnabled(name);
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    await this.ensureAuthenticated();
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Cookie: this.cookie ?? '',
        ...init.headers,
      },
    });
    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }
    return (await response.json()) as T;
  }

  private async ensureAuthenticated(): Promise<void> {
    if (this.cookie) {
      return;
    }

    const response = await fetch(`${this.baseUrl}/api/auth/sign-in/username`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: this.username, password: this.password }),
    });
    if (!response.ok) {
      throw new Error(`Authentication failed (${response.status})`);
    }

    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      this.cookie = setCookie.split(';', 1)[0];
    }
  }
}
