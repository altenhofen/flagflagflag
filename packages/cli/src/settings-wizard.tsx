import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { useState } from 'react';
import type { CliSettings } from './settings.js';
import { WizardLayout, wizardColors } from './wizard-layout.js';

export interface SettingsWizardProps {
  initialSettings: CliSettings;
  onComplete: (settings: CliSettings) => void | Promise<void>;
}

type Setting = keyof CliSettings;

const steps: Array<{ key: Setting; label: string; mask?: string }> = [
  { key: 'host', label: 'Host' },
  { key: 'port', label: 'Port' },
  { key: 'username', label: 'Username' },
  { key: 'password', label: 'Password', mask: '*' },
  { key: 'apiKey', label: 'API key (optional)', mask: '*' },
];

export function SettingsWizard({
  initialSettings,
  onComplete,
}: SettingsWizardProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState(String(initialSettings[steps[0].key]));
  const [error, setError] = useState<string | undefined>();
  const step = steps[index];

  async function submit() {
    const next = { ...settings };
    if (step.key === 'port') {
      const port = Number(value);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        setError('Port must be an integer from 1 to 65535');
        return;
      }
      next.port = port;
    } else if (step.key !== 'apiKey' && !value.trim()) {
      setError(`${step.label} is required`);
      return;
    } else {
      next[step.key] = value.trim();
    }

    setError(undefined);
    setSettings(next);
    if (index === steps.length - 1) {
      await onComplete(next);
      return;
    }

    const nextStep = steps[index + 1];
    setIndex(index + 1);
    setValue(String(next[nextStep.key]));
  }

  return (
    <WizardLayout
      title="Connection setup"
      subtitle="Save the details flagflagflag uses to reach your API."
      step={index + 1}
      totalSteps={steps.length}
      stepLabel={step.label}
      footer="enter continue  ·  blank API key skips  ·  ctrl+c quit"
    >
      <Box flexDirection="column">
        <Text color={wizardColors.ember} bold>
          › <Text color="white">{step.label}</Text>
        </Text>
        <Box marginTop={1}>
          <Text color={wizardColors.muted}>  </Text>
          <TextInput
            value={value}
            onChange={setValue}
            onSubmit={submit}
            mask={step.mask}
          />
        </Box>
        {error ? (
          <Text color="redBright">
            {'  '}! {error}
          </Text>
        ) : null}
      </Box>
    </WizardLayout>
  );
}
