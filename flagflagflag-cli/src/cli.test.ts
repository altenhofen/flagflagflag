import { describe, expect, it, vi } from 'vitest';
import { runCli } from './cli.js';
import type { FlagApi } from './api-client.js';

const api: FlagApi = {
  listProjects: async () => [],
  createProject: async () => ({ id: 'p1', name: 'Demo' }),
  updateProject: async () => ({ id: 'p1', name: 'Demo' }),
  deleteProject: async () => undefined,
  listEnvironments: async () => [],
  createEnvironment: async () => ({
    id: 'e1',
    name: 'staging',
    projectId: 'p1',
  }),
  updateEnvironment: async () => ({
    id: 'e1',
    name: 'staging',
    projectId: 'p1',
  }),
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
  isEnabled: async () => true,
};

describe('flagflagflag CLI', () => {
  it('prints help and exits successfully', async () => {
    const output: string[] = [];

    const exitCode = await runCli(['--help'], {
      api,
      write: (message) => output.push(message),
    });

    expect(exitCode).toBe(0);
    expect(output.join('')).toContain('flagflagflag wizard');
    expect(output.join('')).toContain('--host <hostname>');
    expect(output.join('')).toContain('--port <port>');
    expect(output.join('')).toContain('--username <username>');
  });

  it('evaluates a flag with explicit project and environment context', async () => {
    const output: string[] = [];

    const exitCode = await runCli(
      ['is-enabled', 'checkout', '--project-id', 'p1', '--environment', 'staging'],
      { api, write: (message) => output.push(message) },
    );

    expect(exitCode).toBe(0);
    expect(output.join('')).toContain('enabled');
  });
  it('creates a percentage rollout with ON state from the compact syntax', async () => {
    const output: string[] = [];
    const createFlag = vi.fn(api.createFlag);

    const exitCode = await runCli(
      [
        'flag',
        'new-feature',
        '10%',
        'ON',
        '--project-id',
        'p1',
        '--environment',
        'staging',
      ],
      {
        api: { ...api, createFlag },
        write: (message) => output.push(message),
      },
    );

    expect(exitCode).toBe(0);
    expect(createFlag).toHaveBeenCalledWith(
      'new-feature',
      true,
      'p1',
      'staging',
      10,
    );
    expect(output.join('')).toContain('checkout 10% ON');
  });

  it('creates a project through the project command', async () => {
    const output: string[] = [];

    const exitCode = await runCli(
      ['project', 'create', 'Demo'],
      { api, write: (message) => output.push(message) },
    );

    expect(exitCode).toBe(0);
    expect(output.join('')).toContain('p1 Demo');
  });
});
