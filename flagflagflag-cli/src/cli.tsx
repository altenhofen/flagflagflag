import { render } from 'ink';
import { App } from './app.js';
import { FlagApiClient } from './api-client.js';
import type { FlagApi } from './api-client.js';

export interface CliDependencies {
  api?: FlagApi;
  write: (message: string) => void;
}

const help = `flagflagflag commands:
  flagflagflag wizard
  flagflagflag is-enabled <name> --project-id <id> --environment <name>
  flagflagflag project create <name>
  flagflagflag environment create <project-id> <name>
  flagflagflag flag create <name> --project-id <id> --environment <name> [--enabled]
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

  const api = dependencies.api ?? createApiClient();
  try {
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

function createApiClient(): FlagApiClient {
  return new FlagApiClient({
    baseUrl: process.env.FLAGFLAGFLAG_URL ?? 'http://localhost:3000',
    username: process.env.FLAGFLAGFLAG_USERNAME ?? '',
    password: process.env.FLAGFLAGFLAG_PASSWORD ?? '',
    apiKey: process.env.FLAGFLAGFLAG_API_KEY,
  });
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
