import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { useState } from 'react';
import type { FlagApi } from './api-client.js';

export interface AppProps {
  api: FlagApi;
  onComplete?: () => void;
}

type Step = 'project' | 'environment' | 'flag' | 'enabled' | 'done';

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
      setError('Project name is required');
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
      setStep('flag');
    } catch (cause) {
      setError(getErrorMessage(cause));
    }
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
    return <Text color="green">Created {flagName} in {projectName}/{environmentName}.</Text>;
  }

  const prompt = {
    project: 'Project name',
    environment: 'Environment name',
    flag: 'Feature flag name',
    enabled: 'Enabled? (y/N)',
  }[step];
  const onSubmit = {
    project: submitProject,
    environment: submitEnvironment,
    flag: submitFlag,
    enabled: submitEnabled,
  }[step];

  return (
    <Box flexDirection="column">
      <Text bold>flagflagflag wizard</Text>
      <Text>
        {prompt}:{' '}
        <TextInput
          value={inputValue}
          onChange={setInputValue}
          onSubmit={onSubmit}
        />
      </Text>
      {error ? <Text color="red">{error}</Text> : null}
    </Box>
  );
}

function getErrorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Request failed';
}
