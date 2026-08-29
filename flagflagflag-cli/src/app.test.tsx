import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { App } from './app.js';
import type { FlagApi } from './api-client.js';

const createApi = (): FlagApi => ({
  listProjects: vi.fn(async () => []),
  updateProject: vi.fn(async () => ({ id: 'project-1', name: 'Demo' })),
  deleteProject: vi.fn(async () => undefined),
  listEnvironments: vi.fn(async () => []),
  updateEnvironment: vi.fn(async () => ({
    id: 'environment-1',
    name: 'development',
    projectId: 'project-1',
  })),
  deleteEnvironment: vi.fn(async () => undefined),
  listFlags: vi.fn(async () => []),
  updateFlag: vi.fn(async () => ({
    name: 'checkout',
    projectId: 'project-1',
    environment: 'development',
    enabled: false,
    percentage: 100,
  })),
  deleteFlag: vi.fn(async () => undefined),
  createProject: vi.fn(async () => ({ id: 'project-1', name: 'Demo' })),
  createEnvironment: vi.fn(async () => ({
    id: 'environment-1',
    name: 'development',
    projectId: 'project-1',
  })),
  createFlag: vi.fn(async () => ({
    name: 'checkout',
    projectId: 'project-1',
    environment: 'development',
    enabled: false,
    percentage: 100,
  })),
  isEnabled: vi.fn(async () => false),
});

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 20));

describe('flagflagflag wizard', () => {
  it('starts by asking for a project name', async () => {
    const instance = render(<App api={createApi()} />);
    await tick();

    expect(instance.lastFrame()).toContain('Project name');
    instance.unmount();
  });

  it('skips the dependent setup when the project name is blank', async () => {
    const api = createApi();
    const onComplete = vi.fn();
    const instance = render(<App api={api} onComplete={onComplete} />);
    await tick();

    instance.stdin.write('\r');
    await tick();

    expect(api.createProject).not.toHaveBeenCalled();
    expect(api.createEnvironment).not.toHaveBeenCalled();
    expect(api.createFlag).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledOnce();
    expect(instance.lastFrame()).toContain('Setup skipped');
    expect(instance.lastFrame()).not.toContain('Environment name');
    instance.unmount();
  });

  it('creates a project before asking for an environment', async () => {
    const api = createApi();
    const instance = render(<App api={api} />);
    await tick();

    instance.stdin.write('Demo');
    await tick();
    instance.stdin.write('\r');
    await tick();

    expect(api.createProject).toHaveBeenCalledWith('Demo');
    expect(instance.lastFrame()).toContain('Environment name');
    instance.unmount();
  });
  it('sets up a project without creating a feature flag', async () => {
    const api = createApi();
    const instance = render(<App api={api} />);

    for (const value of ['Demo', 'staging', 'n']) {
      await tick();
      instance.stdin.write(value);
      await tick();
      instance.stdin.write('\r');
    }
    await tick();

    expect(api.createProject).toHaveBeenCalledWith('Demo');
    expect(api.createEnvironment).toHaveBeenCalledWith(
      'project-1',
      'staging',
    );
    expect(api.createFlag).not.toHaveBeenCalled();
    expect(instance.lastFrame()).toContain('Project ready');
    instance.unmount();
  });

  it('creates a project, environment, and optional flag through the wizard', async () => {
    const api = createApi();
    const instance = render(<App api={api} />);

    for (const value of ['Demo', 'staging', 'y', 'checkout', 'y']) {
      await tick();
      instance.stdin.write(value);
      await tick();
      instance.stdin.write('\r');
    }
    await tick();

    expect(api.createProject).toHaveBeenCalledWith('Demo');
    expect(api.createEnvironment).toHaveBeenCalledWith(
      'project-1',
      'staging',
    );
    expect(api.createFlag).toHaveBeenCalledWith(
      'checkout',
      true,
      'project-1',
      'staging',
      100,
    );
    expect(instance.lastFrame()).toContain('Project ready');
    instance.unmount();
  });
});
