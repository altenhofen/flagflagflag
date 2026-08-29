import { render } from 'ink';
import { App } from './app.js';
import { Dashboard } from './dashboard.js';
import { FlagApiClient } from './api-client.js';
import { SettingsWizard } from './settings-wizard.js';
import { FileSettingsStore } from './settings.js';
import type { CliSettings, SettingsStore } from './settings.js';
import type { FlagApi } from './api-client.js';

export interface CommandRequest {
  argv: string[];
  api?: FlagApi;
  settings?: SettingsStore;
}

export interface CommandResult {
  exitCode: number;
  output: string;
}

export interface CommandUi {
  settings(
    settingsStore: SettingsStore,
    afterSave?: (settings: CliSettings) => Promise<number>,
  ): Promise<number>;
  wizard(api: FlagApi): Promise<number>;
  dashboard(api: FlagApi): Promise<number>;
}

const help = `flagflagflag commands:
  flag3 tui [connection options]
  flagflagflag wizard [connection options]
  flagflagflag config
  flagflagflag is-enabled <name> --project-id <id> --environment <name>
  flagflagflag project create <name>
  flagflagflag environment create <project-id> <name>
  flagflagflag flag create <name> [<percentage>%] [ON|OFF] --project-id <id> --environment <name>
  flagflagflag flag <name> <percentage>% <ON|OFF> --project-id <id> --environment <name>

connection options:
  --host <hostname>       API hostname (default: localhost)
  --port <port>           API port (default: 3000)
  --username <username>   Username
  --password <password>   Better Auth password
  --api-key <key>         SDK API key
`;

export async function runCommand(
  request: CommandRequest,
  ui: CommandUi = inkUi,
): Promise<CommandResult> {
  const { argv } = request;
  if (argv[0] === '--help' || argv[0] === 'help' || argv.length === 0) {
    return { exitCode: 0, output: help };
  }

  const settingsStore = request.settings ?? new FileSettingsStore();
  try {
    if (argv[0] === 'config') {
      return { exitCode: await ui.settings(settingsStore), output: '' };
    }
    if (argv[0] === 'wizard' && !request.api) {
      return {
        exitCode: await ui.settings(settingsStore, async () =>
          ui.wizard(await createApiClient(argv, settingsStore)),
        ),
        output: '',
      };
    }

    const api = request.api ?? (await createApiClient(argv, settingsStore));
    if (argv[0] === 'tui') {
      return { exitCode: await ui.dashboard(api), output: '' };
    }
    if (argv[0] === 'wizard') {
      return { exitCode: await ui.wizard(api), output: '' };
    }
    if (argv[0] === 'is-enabled') {
      return await evaluateFlag(argv.slice(1), api);
    }
    if (argv[0] === 'project' && argv[1] === 'create') {
      const project = await api.createProject(argv[2] ?? '');
      return { exitCode: 0, output: `${project.id} ${project.name}\n` };
    }
    if (argv[0] === 'environment' && argv[1] === 'create') {
      const environment = await api.createEnvironment(argv[2] ?? '', argv[3] ?? '');
      return { exitCode: 0, output: `${environment.id} ${environment.name}\n` };
    }
    if (argv[0] === 'flag') {
      return await createFlag(
        argv[1] === 'create' ? argv.slice(2) : argv.slice(1),
        api,
      );
    }
  } catch (cause) {
    return {
      exitCode: 1,
      output: `${cause instanceof Error ? cause.message : 'Request failed'}\n`,
    };
  }

  return { exitCode: 1, output: `Unknown command: ${argv[0]}\n` };
}

function evaluateFlag(argv: string[], api: FlagApi): Promise<CommandResult> {
  const name = argv[0];
  const projectId = getOption(argv, '--project-id');
  const environment = getOption(argv, '--environment');
  if (!name || !projectId || !environment) {
    return Promise.resolve({
      exitCode: 1,
      output:
        'Usage: flagflagflag is-enabled <name> --project-id <id> --environment <name>\n',
    });
  }

  return api.isEnabled(name, projectId, environment).then((enabled) => ({
    exitCode: 0,
    output: `${enabled ? 'enabled' : 'disabled'}\n`,
  }));
}

async function createFlag(argv: string[], api: FlagApi): Promise<CommandResult> {
  const name = argv[0];
  const projectId = getOption(argv, '--project-id');
  const environment = getOption(argv, '--environment');
  const percentageToken =
    argv.find((value) => /^\d+%$/.test(value)) ??
    getOption(argv, '--percentage');
  const percentage = parsePercentage(percentageToken);
  const state = argv.find((value) => /^(ON|OFF)$/i.test(value));
  if (
    !name ||
    !projectId ||
    !environment ||
    percentage === undefined ||
    (state === undefined && percentageToken !== undefined)
  ) {
    return {
      exitCode: 1,
      output:
        'Usage: flagflagflag flag <name> <percentage>% <ON|OFF> --project-id <id> --environment <name>\n',
    };
  }

  const enabled = state ? state.toUpperCase() === 'ON' : argv.includes('--enabled');
  const flag = await api.createFlag(
    name,
    enabled,
    projectId,
    environment,
    percentage ?? 100,
  );
  return {
    exitCode: 0,
    output: `${flag.name} ${percentage ?? 100}% ${enabled ? 'ON' : 'OFF'}\n`,
  };
}

function parsePercentage(value: string | undefined): number | undefined {
  if (value === undefined) {
    return 100;
  }
  const numeric = Number(value.endsWith('%') ? value.slice(0, -1) : value);
  return Number.isInteger(numeric) && numeric >= 0 && numeric <= 100
    ? numeric
    : undefined;
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
    getOption(argv, '--host') ?? process.env.FLAGFLAGFLAG_HOST ?? saved.host;
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

const inkUi: CommandUi = {
  settings: runSettingsWizard,
  wizard: runWizard,
  dashboard: runDashboard,
};

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
          instance.clear();
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
