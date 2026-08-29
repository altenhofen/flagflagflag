import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FileSettingsStore, type CliSettings } from './settings.js';

describe('FileSettingsStore', () => {
  it('persists host, port, and authentication settings', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'flagflagflag-'));
    const store = new FileSettingsStore(join(directory, 'settings.json'));
    const settings: CliSettings = {
      host: 'flags.example.test',
      port: 4310,
      username: 'operator',
      password: 'secret',
      apiKey: 'sdk-key',
    };

    await store.save(settings);

    await expect(store.load()).resolves.toEqual(settings);
    await rm(directory, { recursive: true, force: true });
  });
});
