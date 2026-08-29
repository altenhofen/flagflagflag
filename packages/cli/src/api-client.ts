
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
  percentage: number;
}

export interface FlagApi {
  listProjects(): Promise<Project[]>;
  createProject(name: string): Promise<Project>;
  updateProject(id: string, name: string): Promise<Project>;
  deleteProject(id: string): Promise<void>;
  listEnvironments(projectId: string): Promise<Environment[]>;
  createEnvironment(projectId: string, name: string): Promise<Environment>;
  updateEnvironment(
    projectId: string,
    id: string,
    name: string,
  ): Promise<Environment>;
  deleteEnvironment(projectId: string, id: string): Promise<void>;
  listFlags(projectId: string, environment: string): Promise<FeatureFlag[]>;
  createFlag(
    name: string,
    enabled: boolean,
    projectId: string,
    environment: string,
    percentage: number,
  ): Promise<FeatureFlag>;
  updateFlag(
    name: string,
    enabled: boolean,
    projectId: string,
    environment: string,
    percentage: number,
  ): Promise<FeatureFlag>;
  deleteFlag(
    name: string,
    projectId: string,
    environment: string,
  ): Promise<void>;
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

interface AuthToken {
  token: string;
  expiresAt: string;
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
  async listProjects(): Promise<Project[]> {
    return this.request('/projects', { method: 'GET' });
  }

  async updateProject(id: string, name: string): Promise<Project> {
    return this.request(`/projects/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
  }

  async deleteProject(id: string): Promise<void> {
    await this.request<void>(`/projects/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  async listEnvironments(projectId: string): Promise<Environment[]> {
    return this.request(
      `/projects/${encodeURIComponent(projectId)}/environments`,
      { method: 'GET' },
    );
  }

  async updateEnvironment(
    projectId: string,
    id: string,
    name: string,
  ): Promise<Environment> {
    return this.request(
      `/projects/${encodeURIComponent(projectId)}/environments/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      },
    );
  }

  async deleteEnvironment(projectId: string, id: string): Promise<void> {
    await this.request<void>(
      `/projects/${encodeURIComponent(projectId)}/environments/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
  }

  async listFlags(
    projectId: string,
    environment: string,
  ): Promise<FeatureFlag[]> {
    return this.request(
      `/feature-flags?projectId=${encodeURIComponent(projectId)}&environment=${encodeURIComponent(environment)}`,
      { method: 'GET' },
    );
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
    percentage: number,
  ): Promise<FeatureFlag> {
    return this.request('/feature-flags', {
      method: 'POST',
      body: JSON.stringify({
        name,
        enabled,
        percentage,
        projectId,
        environment,
      }),
    });
  }

  async updateFlag(
    name: string,
    enabled: boolean,
    projectId: string,
    environment: string,
    percentage: number,
  ): Promise<FeatureFlag> {
    return this.request(
      `/feature-flags/${encodeURIComponent(name)}?projectId=${encodeURIComponent(projectId)}&environment=${encodeURIComponent(environment)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ enabled, percentage }),
      },
    );
  }

  async deleteFlag(
    name: string,
    projectId: string,
    environment: string,
  ): Promise<void> {
    await this.request<void>(
      `/feature-flags/${encodeURIComponent(name)}?projectId=${encodeURIComponent(projectId)}&environment=${encodeURIComponent(environment)}`,
      { method: 'DELETE' },
    );
  }

  async isEnabled(
    name: string,
    projectId: string,
    environment: string,
  ): Promise<boolean> {
    const response = await this.request<{ enabled: boolean }>(
      `/feature-flags/${encodeURIComponent(name)}?projectId=${encodeURIComponent(projectId)}&environment=${encodeURIComponent(environment)}`,
      { method: 'GET' },
    );
    return response.enabled;
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
    if (response.status === 204) {
      return undefined as T;
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

    const body = (await response.json()) as AuthToken;
    if (typeof body.token !== 'string') {
      throw new Error('Authentication failed (missing token)');
    }
    this.cookie = `flagflagflag_session=${body.token}`;
  }
}
