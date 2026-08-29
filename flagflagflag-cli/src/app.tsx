import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { useState } from 'react';
import type { FlagApi } from './api-client.js';
import { WizardLayout, wizardColors } from './wizard-layout.js';

export interface AppProps {
  api: FlagApi;
  onComplete?: () => void;
}

type Step = 'project' | 'environment' | 'flag-choice' | 'flag' | 'enabled' | 'done';

const stepDetails = {
  project: { number: 1, label: 'Project' },
  environment: { number: 2, label: 'Environment' },
  'flag-choice': { number: 3, label: 'Feature flag' },
  flag: { number: 4, label: 'Flag name' },
  enabled: { number: 5, label: 'Initial state' },
} as const;

export function App({ api, onComplete }: AppProps) {
  const [step, setStep] = useState<Step>('project');
  const [projectId, setProjectId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [environmentName, setEnvironmentName] = useState('');
  const [flagName, setFlagName] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | undefined>();

  async function submitProject(value: string) {
    setError(undefined);
    if (!value.trim()) {
      setStep('done');
      onComplete?.();
      return;
    }

    try {
      const project = await api.createProject(value.trim());
      setProjectId(project.id);
      setProjectName(project.name);
      setInputValue('');
      setStep('environment');
    } catch (cause) {
      setError(getErrorMessage(cause));
    }
  }

  async function submitEnvironment(value: string) {
    setError(undefined);
    if (!value.trim()) {
      setError('Environment name is required');
      return;
    }

    try {
      await api.createEnvironment(projectId, value.trim());
      setEnvironmentName(value.trim());
      setInputValue('');
      setStep('flag-choice');
    } catch (cause) {
      setError(getErrorMessage(cause));
    }
  }

  function submitFlagChoice(value: string) {
    setError(undefined);
    const choice = value.trim().toLowerCase();
    if (choice === '' || choice === 'n' || choice === 'no') {
      setStep('done');
      onComplete?.();
      return;
    }
    if (choice !== 'y' && choice !== 'yes') {
      setError('Choose yes or no');
      return;
    }

    setInputValue('');
    setStep('flag');
  }

  async function submitFlag(value: string) {
    setError(undefined);
    if (!value.trim()) {
      setError('Feature flag name is required');
      return;
    }

    setFlagName(value.trim());
    setInputValue('');
    setStep('enabled');
  }

  async function submitEnabled(value: string) {
    setError(undefined);
    try {
      await api.createFlag(
        flagName,
        value.trim().toLowerCase() === 'y' || value.trim().toLowerCase() === 'yes',
        projectId,
        environmentName,
      );
      setStep('done');
      onComplete?.();
    } catch (cause) {
      setError(getErrorMessage(cause));
    }
  }

  if (step === 'done') {
    if (!projectId) {
      return (
        <Box flexDirection="column">
          <Text color="yellowBright" bold>
            ○ Setup skipped
          </Text>
          <Text color="gray">
            No project, environment, or feature flag was created.
          </Text>
        </Box>
      );
    }

    return (
      <Box flexDirection="column">
        <Text color="greenBright" bold>
          ✓ Project ready
        </Text>
        <Text color="gray">
          {projectName} / {environmentName}
        </Text>
        <Text color="gray">Add a feature flag later from the dashboard.</Text>
      </Box>
    );
  }

  const detail = stepDetails[step];
  const prompt = {
    project: 'Project name (optional)',
    environment: 'Environment name',
    'flag-choice': 'Create a feature flag now? (y/N)',
    flag: 'Feature flag name',
    enabled: 'Enable it initially? (y/N)',
  }[step];
  const onSubmit = {
    project: submitProject,
    environment: submitEnvironment,
    'flag-choice': submitFlagChoice,
    flag: submitFlag,
    enabled: submitEnabled,
  }[step];

  return (
    <WizardLayout
      title="Project setup"
      subtitle="Create a project and its first environment."
      step={detail.number}
      totalSteps={5}
      stepLabel={detail.label}
    >
      <Box flexDirection="column">
        <Text color={wizardColors.ember} bold>
          › <Text color="white">{prompt}</Text>
        </Text>
        <Box marginTop={1}>
          <Text color={wizardColors.muted}>  </Text>
          <TextInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={onSubmit}
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

function getErrorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Request failed';
}
