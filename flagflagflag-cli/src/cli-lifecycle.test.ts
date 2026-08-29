import { describe, expect, it, vi } from 'vitest';
import type * as Ink from 'ink';
import type { ReactElement } from 'react';

vi.mock('ink', async () => {
  const actual = await vi.importActual<typeof Ink>('ink');
  return { ...actual, render: vi.fn() };
});

import { render } from 'ink';
import { runCli } from './cli.js';
import type { CliSettings, SettingsStore } from './settings.js';

const settings: CliSettings = {
  host: 'localhost',
  port: 3000,
  username: 'flag3',
  password: 'flag3',
  apiKey: '',
};

describe('CLI Ink lifecycle', () => {
  it('waits for settings teardown before mounting the project wizard', async () => {
    const renderMock = vi.mocked(render);
    const exit = Promise.withResolvers<void>();
    const settingsInstance = {
      unmount: vi.fn(),
      waitUntilExit: vi.fn(() => exit.promise),
    };
    const projectInstance = { unmount: vi.fn() };
    renderMock.mockImplementation(() => {
      const instance = renderMock.mock.calls.length === 1
        ? settingsInstance
        : projectInstance;
      return instance as unknown as ReturnType<typeof render>;
    });

    const store: SettingsStore = {
      load: vi.fn(async () => ({ ...settings })),
      save: vi.fn(async () => undefined),
    };
    const runPromise = runCli(['wizard'], { settings: store, write: vi.fn() });

    await vi.waitFor(() => expect(renderMock).toHaveBeenCalledOnce());
    const settingsWizard = renderMock.mock.calls[0][0] as ReactElement<{
      onComplete: (nextSettings: CliSettings) => Promise<void>;
    }>;
    const completion = settingsWizard.props.onComplete(settings);
    await vi.waitFor(() => expect(settingsInstance.unmount).toHaveBeenCalledOnce());

    expect(renderMock).toHaveBeenCalledOnce();
    exit.resolve();
    await vi.waitFor(() => expect(renderMock).toHaveBeenCalledTimes(2));
    const projectWizard = renderMock.mock.calls[1][0] as ReactElement<{
      onComplete: () => void;
    }>;
    projectWizard.props.onComplete();
    await completion;
    await expect(runPromise).resolves.toBe(0);
  });
});
