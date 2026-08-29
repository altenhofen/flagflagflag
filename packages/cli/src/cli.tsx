import { runCommand } from './command.js';
import type { CommandRequest } from './command.js';
import type { FlagApi } from './api-client.js';
import type { SettingsStore } from './settings.js';

export interface CliDependencies {
  api?: FlagApi;
  settings?: SettingsStore;
  write: (message: string) => void;
}

export async function runCli(
  argv: string[],
  dependencies: CliDependencies = {
    write: (message) => process.stdout.write(message),
  },
): Promise<number> {
  const request: CommandRequest = {
    argv,
    api: dependencies.api,
    settings: dependencies.settings,
  };
  const result = await runCommand(request);
  dependencies.write(result.output);
  return result.exitCode;
}
