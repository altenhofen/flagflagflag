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
});
