import { describe, expect, it } from 'vitest';
import { render } from 'ink-testing-library';
import { SettingsWizard } from './settings-wizard.js';
import { defaultSettings } from './settings.js';

describe('connection settings wizard', () => {
  it('starts with the saved hostname field', async () => {
    const instance = render(
      <SettingsWizard
        initialSettings={{ ...defaultSettings, host: 'flags.example.test' }}
        onComplete={async () => undefined}
      />,
    );
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(instance.lastFrame()).toContain('flags.example.test');
    instance.unmount();
  });
  it('calls the credential field Username', async () => {
    const instance = render(
      <SettingsWizard
        initialSettings={defaultSettings}
        onComplete={async () => undefined}
      />,
    );
    await new Promise((resolve) => setTimeout(resolve, 20));

    instance.stdin.write('\r');
    await new Promise((resolve) => setTimeout(resolve, 20));
    instance.stdin.write('\r');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(instance.lastFrame()).toContain('Username');
    expect(instance.lastFrame()).not.toContain('Better Auth username');
    instance.unmount();
  });
});
