import { describe, expect, it } from 'vitest';
import { runCli } from './cli.js';

describe('flagflagflag CLI', () => {
  it('prints help and exits successfully', async () => {
    const output: string[] = [];

    const exitCode = await runCli(['--help'], {
      write: (message) => output.push(message),
    });

    expect(exitCode).toBe(0);
    expect(output.join('')).toContain('flagflagflag wizard');
  });
  it('evaluates a flag with explicit project and environment context', async () => {
    const output: string[] = [];
    const api = {
      createProject: async () => ({ id: 'p1', name: 'Demo' }),
      createEnvironment: async () => ({
        id: 'e1',
        name: 'staging',
        projectId: 'p1',
      }),
      createFlag: async () => ({
        name: 'checkout',
        projectId: 'p1',
        environment: 'staging',
        enabled: true,
      }),
      isEnabled: async () => true,
    };

    const exitCode = await runCli(
      ['is-enabled', 'checkout', '--project-id', 'p1', '--environment', 'staging'],
      { api, write: (message) => output.push(message) },
    );

    expect(exitCode).toBe(0);
    expect(output.join('')).toContain('enabled');
  });
  it('creates a project through the project command', async () => {
    const output: string[] = [];
    const api = {
      createProject: async () => ({ id: 'p1', name: 'Demo' }),
      createEnvironment: async () => ({
        id: 'e1',
        name: 'staging',
        projectId: 'p1',
      }),
      createFlag: async () => ({
        name: 'checkout',
        projectId: 'p1',
        environment: 'staging',
        enabled: true,
      }),
      isEnabled: async () => false,
    };

    const exitCode = await runCli(
      ['project', 'create', 'Demo'],
      { api, write: (message) => output.push(message) },
    );

    expect(exitCode).toBe(0);
    expect(output.join('')).toContain('p1 Demo');
  });
});
