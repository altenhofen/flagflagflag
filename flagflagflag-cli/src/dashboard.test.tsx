import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { Dashboard } from './dashboard.js';
import type { FlagApi } from './api-client.js';

const api: FlagApi = {
  listProjects: async () => [],
  createProject: async () => ({ id: 'p1', name: 'Payments' }),
  updateProject: async () => ({ id: 'p1', name: 'Payments' }),
  deleteProject: async () => undefined,
  listEnvironments: async () => [],
  createEnvironment: async () => ({ id: 'e1', name: 'staging', projectId: 'p1' }),
  updateEnvironment: async () => ({ id: 'e1', name: 'staging', projectId: 'p1' }),
  deleteEnvironment: async () => undefined,
  listFlags: async () => [],
  createFlag: async () => ({
    name: 'checkout',
    projectId: 'p1',
    environment: 'staging',
    enabled: true,
    percentage: 100,
  }),
  updateFlag: async () => ({
    name: 'checkout',
    projectId: 'p1',
    environment: 'staging',
    enabled: true,
    percentage: 100,
  }),
  deleteFlag: async () => undefined,
  isEnabled: async () => false,
};

describe('Ember CRUD dashboard', () => {
  it('shows the project workspace', async () => {
    const instance = render(<Dashboard api={api} />);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(instance.lastFrame()).toContain('FLAGFLAGFLAG / PROJECTS');
    expect(instance.lastFrame()).toContain('No projects yet');
    instance.unmount();
  });

  it('creates a project from the dashboard', async () => {
    let created = false;
    const createProject = vi.fn(async () => {
      created = true;
      return { id: 'p1', name: 'Payments' };
    });
    const dashboardApi: FlagApi = {
      ...api,
      createProject,
      listProjects: async () =>
        created ? [{ id: 'p1', name: 'Payments' }] : [],
    };
    const instance = render(<Dashboard api={dashboardApi} />);
    await new Promise((resolve) => setTimeout(resolve, 20));

    instance.stdin.write('n');
    await new Promise((resolve) => setTimeout(resolve, 20));
    instance.stdin.write('Payments');
    await new Promise((resolve) => setTimeout(resolve, 20));
    instance.stdin.write('\r');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(createProject).toHaveBeenCalledWith('Payments');
    expect(instance.lastFrame()).toContain('Payments');
    instance.unmount();
  });
  it('toggles the selected feature flag with e', async () => {
    let enabled = false;
    const updateFlag = vi.fn(
      async (
        name: string,
        nextEnabled: boolean,
        projectId: string,
        environment: string,
      ) => {
        enabled = nextEnabled;
        return { name, projectId, environment, enabled, percentage: 100 };
      },
    );
    const dashboardApi: FlagApi = {
      ...api,
      listProjects: async () => [{ id: 'p1', name: 'Payments' }],
      listEnvironments: async () => [
        { id: 'e1', name: 'staging', projectId: 'p1' },
      ],
      listFlags: async () => [
        {
          name: 'checkout',
          projectId: 'p1',
          environment: 'staging',
          enabled,
          percentage: 100,
        },
      ],
      updateFlag,
    };
    const instance = render(<Dashboard api={dashboardApi} />);
    await new Promise((resolve) => setTimeout(resolve, 40));

    instance.stdin.write('\t');
    await new Promise((resolve) => setTimeout(resolve, 20));
    instance.stdin.write('\t');
    await new Promise((resolve) => setTimeout(resolve, 40));
    instance.stdin.write('e');
    await new Promise((resolve) => setTimeout(resolve, 40));

    expect(updateFlag).toHaveBeenCalledWith(
      'checkout',
      true,
      'p1',
      'staging',
      100,
    );
    expect(instance.lastFrame()).toContain('checkout');
    expect(instance.lastFrame()).toContain('ON');
    instance.unmount();
  });

  it('moves the active project with the down arrow key', async () => {
    const projects = [
      { id: 'p1', name: 'Payments' },
      { id: 'p2', name: 'Growth' },
    ];
    const dashboardApi: FlagApi = {
      ...api,
      listProjects: async () => projects,
    };
    const instance = render(<Dashboard api={dashboardApi} />);
    await new Promise((resolve) => setTimeout(resolve, 40));

    instance.stdin.write('\u001b[B');
    await new Promise((resolve) => setTimeout(resolve, 40));

    expect(instance.lastFrame()).toContain('project: Growth');
    instance.unmount();
  });

  it('uses down arrow to leave an empty section', async () => {
    const instance = render(<Dashboard api={api} />);
    await new Promise((resolve) => setTimeout(resolve, 40));

    instance.stdin.write('\u001b[B');
    await new Promise((resolve) => setTimeout(resolve, 40));

    expect(instance.lastFrame()).toContain('FLAGFLAGFLAG / ENVIRONMENTS');
    instance.unmount();
  });
});
