import { render } from 'ink';
import { App } from './app.js';
import { Dashboard } from './dashboard.js';
import { FlagApiClient } from './api-client.js';
import { SettingsWizard } from './settings-wizard.js';
import { FileSettingsStore } from './settings.js';
import type { CliSettings, SettingsStore } from './settings.js';
import type { FlagApi } from './api-client.js';

export interface CliDependencies {
  api?: FlagApi;
  settings?: SettingsStore;
  write: (message: string) => void;
}

const help = `flagflagflag commands:
  flag3 tui [connection options]
  flagflagflag wizard [connection options]
  flagflagflag config
  flagflagflag is-enabled <name> --project-id <id> --environment <name>
  flagflagflag project create <name>
  flagflagflag environment create <project-id> <name>
  flagflagflag flag create <name> --project-id <id> --environment <name> [--enabled]

connection options:
  --host <hostname>       API hostname (default: localhost)
  --port <port>           API port (default: 3000)
  --username <username>   Username
  --password <password>   Better Auth password
  --api-key <key>         SDK API key
`;
export async function runCli(
  argv: string[],
  dependencies: CliDependencies = {
    write: (message) => process.stdout.write(message),
  },
): Promise<number> {
  if (argv[0] === '--help' || argv[0] === 'help' || argv.length === 0) {
    dependencies.write(help);
    return 0;
  }

  const settingsStore = dependencies.settings ?? new FileSettingsStore();
  if (argv[0] === 'config') {
    return runSettingsWizard(settingsStore);
  }
  if (argv[0] === 'wizard' && !dependencies.api) {
    return runWizardWithSettings(argv, settingsStore);
  }

  try {
    const api = dependencies.api ?? (await createApiClient(argv, settingsStore));
    if (argv[0] === 'tui') {
      return await runDashboard(api);
    }
    if (argv[0] === 'wizard') {
      return await runWizard(api);
    }
    if (argv[0] === 'is-enabled') {
      return await evaluateFlag(argv.slice(1), api, dependencies.write);
    }
    if (argv[0] === 'project' && argv[1] === 'create') {
      const project = await api.createProject(argv[2] ?? '');
      dependencies.write(`${project.id} ${project.name}\\n`);
      return 0;
    }
    if (argv[0] === 'environment' && argv[1] === 'create') {
      const environment = await api.createEnvironment(argv[2] ?? '', argv[3] ?? '');
      dependencies.write(`${environment.id} ${environment.name}\\n`);
      return 0;
    }
    if (argv[0] === 'flag' && argv[1] === 'create') {
      return await createFlag(argv.slice(2), api, dependencies.write);
    }
  } catch (cause) {
    dependencies.write(`${cause instanceof Error ? cause.message : 'Request failed'}\\n`);
    return 1;
  }

  dependencies.write(`Unknown command: ${argv[0]}\\n`);
  return 1;
}

async function evaluateFlag(
  argv: string[],
  api: FlagApi,
  write: (message: string) => void,
): Promise<number> {
  const name = argv[0];
  const projectId = getOption(argv, '--project-id');
  const environment = getOption(argv, '--environment');
  if (!name || !projectId || !environment) {
    write('Usage: flagflagflag is-enabled <name> --project-id <id> --environment <name>\\n');
    return 1;
  }

  write(
    (await api.isEnabled(name, projectId, environment) ? 'enabled' : 'disabled') +
      '\\n',
  );
  return 0;
}

async function createFlag(
  argv: string[],
  api: FlagApi,
  write: (message: string) => void,
): Promise<number> {
  const name = argv[0];
  const projectId = getOption(argv, '--project-id');
  const environment = getOption(argv, '--environment');
  if (!name || !projectId || !environment) {
    write('Usage: flagflagflag flag create <name> --project-id <id> --environment <name> [--enabled]\\n');
    return 1;
  }

  const flag = await api.createFlag(
    name,
    argv.includes('--enabled'),
    projectId,
    environment,
  );
  write(`${flag.name} ${flag.enabled ? 'enabled' : 'disabled'}\\n`);
  return 0;
}

function getOption(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index === -1 ? undefined : argv[index + 1];
}

async function createApiClient(
  argv: string[],
  settingsStore: SettingsStore,
): Promise<FlagApiClient> {
  const saved = await settingsStore.load();
  const host =
    getOption(argv, '--host') ??
    process.env.FLAGFLAGFLAG_HOST ??
    saved.host;
  const portValue =
    getOption(argv, '--port') ??
    process.env.FLAGFLAGFLAG_PORT ??
    String(saved.port);
  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Port must be an integer from 1 to 65535');
  }

  return new FlagApiClient({
    baseUrl: process.env.FLAGFLAGFLAG_URL ?? `http://${host}:${port}`,
    username:
      getOption(argv, '--username') ??
      process.env.FLAGFLAGFLAG_USERNAME ??
      saved.username,
    password:
      getOption(argv, '--password') ??
      process.env.FLAGFLAGFLAG_PASSWORD ??
      saved.password,
    apiKey:
      getOption(argv, '--api-key') ??
      process.env.FLAGFLAGFLAG_API_KEY ??
      saved.apiKey,
  });
}
async function runWizardWithSettings(
  argv: string[],
  settingsStore: SettingsStore,
): Promise<number> {
  return runSettingsWizard(settingsStore, async (settings) => {
    const api = await createApiClient(argv, settingsStore);
    return runWizard(api);
  });
}

async function runSettingsWizard(
  settingsStore: SettingsStore,
  afterSave?: (settings: CliSettings) => Promise<number>,
): Promise<number> {
  const { promise, resolve, reject } = Promise.withResolvers<number>();
  const initialSettings = await settingsStore.load();
  let unmount: () => void = () => undefined;
  const instance = render(
    <SettingsWizard
      initialSettings={initialSettings}
      onComplete={async (settings) => {
        try {
          await settingsStore.save(settings);
          unmount();
          await exitPromise;
          resolve((await afterSave?.(settings)) ?? 0);
        } catch (cause) {
          reject(cause);
        }
      }}
    />,
  );
  const exitPromise = instance.waitUntilExit();
  unmount = instance.unmount;
  return promise;
}


async function runWizard(api: FlagApi): Promise<number> {
  const { promise, resolve } = Promise.withResolvers<number>();
  let unmount: () => void = () => undefined;
  const instance = render(
    <App
      api={api}
      onComplete={() => {
        unmount();
        resolve(0);
      }}
    />,
  );
  unmount = instance.unmount;
  return promise;
}

async function runDashboard(api: FlagApi): Promise<number> {
  const { promise, resolve } = Promise.withResolvers<number>();
  let unmount: () => void = () => undefined;
  const instance = render(
    <Dashboard
      api={api}
      onExit={() => {
        unmount();
        resolve(0);
      }}
    />,
  );
  unmount = instance.unmount;
  return promise;
}
