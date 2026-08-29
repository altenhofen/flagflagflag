import { describe, expect, it } from 'vitest';
import { runCommand } from './command.js';
import type { CommandUi } from './command.js';
import type { CliSettings, SettingsStore } from './settings.js';

const settings: CliSettings = {
  host: 'localhost',
  port: 3000,
  username: 'flag3',
  password: 'flag3',
  apiKey: '',
};

describe('CLI command lifecycle', () => {
  it('waits for settings teardown before mounting the project wizard', async () => {
    const lifecycle: string[] = [];
    const store: SettingsStore = {
      load: async () => settings,
      save: async () => undefined,
    };
    const ui: CommandUi = {
      settings: async (_store, afterSave) => {
        lifecycle.push('settings-mounted');
        lifecycle.push('settings-unmounted');
        await Promise.resolve();
        lifecycle.push('settings-exited');
        return (await afterSave?.(settings)) ?? 0;
      },
      wizard: async () => {
        lifecycle.push('project-wizard-mounted');
        return 0;
      },
      dashboard: async () => 0,
    };

    const result = await runCommand(
      { argv: ['wizard'], settings: store },
      ui,
    );

    expect(result).toEqual({ exitCode: 0, output: '' });
    expect(lifecycle).toEqual([
      'settings-mounted',
      'settings-unmounted',
      'settings-exited',
      'project-wizard-mounted',
    ]);
  });
});
