import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export interface CliSettings {
  host: string;
  port: number;
  username: string;
  password: string;
  apiKey: string;
}

export interface SettingsStore {
  load(): Promise<CliSettings>;
  save(settings: CliSettings): Promise<void>;
}

export const defaultSettings: CliSettings = {
  host: 'localhost',
  port: 3000,
  username: '',
  password: '',
  apiKey: '',
};

export function getSettingsPath(): string {
  return (
    process.env.FLAGFLAGFLAG_CONFIG ??
    join(
      process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'),
      'flagflagflag',
      'settings.json',
    )
  );
}

export class FileSettingsStore implements SettingsStore {
  constructor(private readonly path = getSettingsPath()) {}

  async load(): Promise<CliSettings> {
    try {
      const raw = await readFile(this.path, 'utf8');
      return parseSettings(JSON.parse(raw));
    } catch (cause) {
      if (isMissingFile(cause)) {
        return { ...defaultSettings };
      }
      throw cause;
    }
  }

  async save(settings: CliSettings): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    await writeFile(this.path, `${JSON.stringify(settings, null, 2)}\n`, {
      mode: 0o600,
    });
    await chmod(this.path, 0o600);
  }
}

function parseSettings(value: unknown): CliSettings {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Invalid flagflagflag settings file');
  }
  const settings = value as Record<string, unknown>;
  if (
    typeof settings.host !== 'string' ||
    typeof settings.port !== 'number' ||
    !Number.isInteger(settings.port) ||
    settings.port < 1 ||
    settings.port > 65535 ||
    typeof settings.username !== 'string' ||
    typeof settings.password !== 'string' ||
    typeof settings.apiKey !== 'string'
  ) {
    throw new Error('Invalid flagflagflag settings file');
  }
  return {
    host: settings.host,
    port: settings.port,
    username: settings.username,
    password: settings.password,
    apiKey: settings.apiKey,
  };
}

function isMissingFile(cause: unknown): boolean {
  return (
    typeof cause === 'object' &&
    cause !== null &&
    'code' in cause &&
    cause.code === 'ENOENT'
  );
}
