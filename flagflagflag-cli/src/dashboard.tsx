import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { useEffect, useState } from 'react';
import type {
  Environment,
  FeatureFlag,
  FlagApi,
  Project,
} from './api-client.js';

export interface DashboardProps {
  api: FlagApi;
  onExit?: () => void;
}

type Section = 'projects' | 'environments' | 'flags';
type Resource = 'project' | 'environment' | 'flag';
type FormStep = 'name' | 'enabled';

interface FormState {
  resource: Resource;
  action: 'create' | 'edit';
  step: FormStep;
  value: string;
}

export function Dashboard({ api, onExit }: DashboardProps) {
  const [section, setSection] = useState<Section>('projects');
  const [projects, setProjects] = useState<Project[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [projectIndex, setProjectIndex] = useState(0);
  const [environmentIndex, setEnvironmentIndex] = useState(0);
  const [flagIndex, setFlagIndex] = useState(0);
  const [form, setForm] = useState<FormState | undefined>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const selectedProject = projects[projectIndex];
  const selectedEnvironment = environments[environmentIndex];
  const selectedFlag = flags[flagIndex];

  async function refresh() {
    setLoading(true);
    setError(undefined);
    try {
      const nextProjects = await api.listProjects();
      setProjects(nextProjects);
      const nextProject = nextProjects[projectIndex] ?? nextProjects[0];
      if (!nextProject) {
        setEnvironments([]);
        setFlags([]);
        return;
      }

      const nextEnvironments = await api.listEnvironments(nextProject.id);
      setEnvironments(nextEnvironments);
      const nextEnvironment =
        nextEnvironments[environmentIndex] ?? nextEnvironments[0];
      if (!nextEnvironment) {
        setFlags([]);
        return;
      }

      setFlags(await api.listFlags(nextProject.id, nextEnvironment.name));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (projects.length > 0) {
      void refresh();
    }
  }, [projectIndex, environmentIndex]);

  useInput((input, key) => {
    if (form) {
      return;
    }
    if (input === 'q' || key.escape) {
      onExit?.();
      return;
    }
    if (input === 'r') {
      void refresh();
      return;
    }
    if (key.tab || key.rightArrow) {
      setSection(section === 'projects' ? 'environments' : section === 'environments' ? 'flags' : 'projects');
      return;
    }
    if (key.leftArrow) {
      setSection(section === 'projects' ? 'flags' : section === 'environments' ? 'projects' : 'environments');
      return;
    }
    if (key.upArrow || input === 'k') {
      moveSelection(-1);
      return;
    }
    if (key.downArrow || input === 'j') {
      moveSelection(1);
      return;
    }
    if (input === 'n') {
      beginCreate();
      return;
    }
    if (input === 'e') {
      beginEdit();
      return;
    }
    if (input === 'd' && currentItem()) {
      setConfirmDelete(true);
      return;
    }
    if (confirmDelete && input === 'y') {
      void removeCurrent();
      return;
    }
    if (confirmDelete && input === 'n') {
      setConfirmDelete(false);
    }
  });

  function currentItem(): Project | Environment | FeatureFlag | undefined {
    return section === 'projects'
      ? selectedProject
      : section === 'environments'
        ? selectedEnvironment
        : selectedFlag;
  }

  function moveSelection(delta: number) {
    if (section === 'projects') {
      setProjectIndex(Math.max(0, Math.min(projects.length - 1, projectIndex + delta)));
    } else if (section === 'environments') {
      setEnvironmentIndex(Math.max(0, Math.min(environments.length - 1, environmentIndex + delta)));
    } else {
      setFlagIndex(Math.max(0, Math.min(flags.length - 1, flagIndex + delta)));
    }
  }

  function beginCreate() {
    if (section !== 'projects' && !selectedProject) {
      setError('Create a project first');
      return;
    }
    if (section === 'flags' && !selectedEnvironment) {
      setError('Create an environment first');
      return;
    }
    setConfirmDelete(false);
    setInputValue('');
    setForm({
      resource: section === 'projects' ? 'project' : section === 'environments' ? 'environment' : 'flag',
      action: 'create',
      step: 'name',
      value: '',
    });
  }

  function beginEdit() {
    setConfirmDelete(false);
    setInputValue('');
    if (section === 'flags') {
      if (!selectedFlag) {
        return;
      }
      setForm({
        resource: 'flag',
        action: 'edit',
        step: 'enabled',
        value: selectedFlag.enabled ? 'y' : 'n',
      });
      return;
    }
    if (section === 'projects') {
      if (!selectedProject) {
        return;
      }
      setForm({
        resource: 'project',
        action: 'edit',
        step: 'name',
        value: selectedProject.name,
      });
      return;
    }
    if (!selectedEnvironment) {
      return;
    }
    setForm({
      resource: 'environment',
      action: 'edit',
      step: 'name',
      value: selectedEnvironment.name,
    });
  }

  async function submitForm(value: string) {
    if (!form) {
      return;
    }
    const trimmed = value.trim();
    if (form.step === 'name' && !trimmed) {
      setError('A name is required');
      return;
    }
    setError(undefined);

    if (form.resource === 'flag' && form.step === 'name') {
      setInputValue('');
      setForm({ ...form, step: 'enabled', value: trimmed });
      return;
    }

    try {
      if (form.resource === 'project') {
        if (form.action === 'create') {
          await api.createProject(trimmed);
        } else if (selectedProject) {
          await api.updateProject(selectedProject.id, trimmed);
        }
      } else if (form.resource === 'environment') {
        if (!selectedProject || !selectedEnvironment) {
          throw new Error('Select a project and environment first');
        }
        if (form.action === 'create') {
          await api.createEnvironment(selectedProject.id, trimmed);
        } else {
          await api.updateEnvironment(
            selectedProject.id,
            selectedEnvironment.id,
            trimmed,
          );
        }
      } else {
        if (!selectedProject || !selectedEnvironment) {
          throw new Error('Select a project and environment first');
        }
        const enabled =
          value.toLowerCase() === 'y' || value.toLowerCase() === 'yes';
        if (form.action === 'create') {
          await api.createFlag(
            form.value,
            enabled,
            selectedProject.id,
            selectedEnvironment.name,
          );
        } else if (selectedFlag) {
          await api.updateFlag(
            selectedFlag.name,
            enabled,
            selectedProject.id,
            selectedEnvironment.name,
          );
        }
      }
      setForm(undefined);
      setInputValue('');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Request failed');
    }
  }

  async function removeCurrent() {
    try {
      if (section === 'projects') {
        if (!selectedProject) {
          return;
        }
        await api.deleteProject(selectedProject.id);
      } else if (section === 'environments') {
        if (!selectedProject || !selectedEnvironment) {
          return;
        }
        await api.deleteEnvironment(
          selectedProject.id,
          selectedEnvironment.id,
        );
      } else {
        if (!selectedProject || !selectedEnvironment || !selectedFlag) {
          return;
        }
        await api.deleteFlag(
          selectedFlag.name,
          selectedProject.id,
          selectedEnvironment.name,
        );
      }
      setConfirmDelete(false);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Request failed');
    }
  }

  const title = section === 'projects' ? 'PROJECTS' : section === 'environments' ? 'ENVIRONMENTS' : 'FLAGS';
  const formPrompt = form?.resource === 'flag' && form.step === 'enabled'
    ? 'Enabled? (y/N)'
    : form?.resource === 'project'
      ? 'Project name'
      : form?.resource === 'environment'
        ? 'Environment name'
        : 'Feature flag name';

  return (
    <Box flexDirection="column" padding={1}>
      <Box>
        <Text color="red">◆</Text><Text color="redBright" bold> FLAGFLAGFLAG </Text>
        <Text color="gray">/ {title}</Text>
      </Box>
      <Text color="gray">────────────────────────────────────────────────────────────</Text>
      <Box>
        <Box flexDirection="column" width={16}>
          <Text color={section === 'projects' ? 'redBright' : 'gray'}>› Projects</Text>
          <Text color={section === 'environments' ? 'redBright' : 'gray'}>› Environs</Text>
          <Text color={section === 'flags' ? 'redBright' : 'gray'}>› Flags</Text>
        </Box>
        <Box flexDirection="column">
          <Text color="gray">project: {selectedProject?.name ?? '—'}</Text>
          <Text color="gray">environment: {selectedEnvironment?.name ?? '—'}</Text>
          <Text color="gray">──────────────────────────────────────</Text>
          {form ? (
            <Text>{formPrompt}: <TextInput value={inputValue} onChange={setInputValue} onSubmit={submitForm} /></Text>
          ) : (
            <RecordList section={section} projects={projects} environments={environments} flags={flags} projectIndex={projectIndex} environmentIndex={environmentIndex} flagIndex={flagIndex} loading={loading} />
          )}
        </Box>
      </Box>
      {error ? <Text color="redBright">! {error}</Text> : null}
      {confirmDelete ? <Text color="yellow">Delete this record? y/n</Text> : null}
      <Text color="gray">────────────────────────────────────────────────────────────</Text>
      <Text color="gray">↑↓ navigate  tab switch  n new  e edit  d delete  r refresh  q quit</Text>
    </Box>
  );
}

interface RecordListProps {
  section: Section;
  projects: Project[];
  environments: Environment[];
  flags: FeatureFlag[];
  projectIndex: number;
  environmentIndex: number;
  flagIndex: number;
  loading: boolean;
}

function RecordList({ section, projects, environments, flags, projectIndex, environmentIndex, flagIndex, loading }: RecordListProps) {
  if (loading) {
    return <Text color="yellow">Loading ember records…</Text>;
  }
  const records = section === 'projects' ? projects : section === 'environments' ? environments : flags;
  if (records.length === 0) {
    return <Text color="gray">No {section} yet. Press n to create one.</Text>;
  }
  return records.map((record, index) => {
    const selected = section === 'projects' ? index === projectIndex : section === 'environments' ? index === environmentIndex : index === flagIndex;
    const label = 'name' in record ? record.name : '';
    const state = 'enabled' in record ? record.enabled ? 'ON' : 'OFF' : '';
    return <Text key={`${label}-${index}`} color={selected ? 'redBright' : 'white'}>{selected ? '› ' : '  '}{label.padEnd(28)} {state}</Text>;
  });
}
