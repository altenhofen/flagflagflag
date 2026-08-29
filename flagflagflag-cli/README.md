# flagflagflag CLI

Internal implementation notes for the Ink-based feature-flag CLI.

## Purpose

The CLI is the terminal control surface for projects, environments, and feature
flags. It provides:

- `flag3 tui`: an interactive CRUD dashboard.
- `flagflagflag wizard`: a guided project and environment setup flow with an
  optional feature flag.
- Direct commands for project creation, environment creation, flag creation, and
  flag evaluation.

The published package exposes both `flag3` and `flagflagflag` binaries. The
short `flag3` name is the preferred interactive command.

## Local development

Run commands from this package directory:

```bash
pnpm install
pnpm build
pnpm test
pnpm start --help
```

The `prebuild` and `pretest` scripts build the sibling
`../flagflagflag-ts-sdk` package first. The CLI imports the SDK through the
`@flagflagflag/ts-sdk` package dependency.

## Connection and authentication

The CLI API client talks to the server over HTTP. Mutating operations authenticate
with Better Auth username/password credentials. Flag evaluation uses the renamed
TypeScript SDK and sends its API key as `X-API-Key`.

Connection options can be supplied on the command line:

```text
--host <hostname>
--port <port>
--username <username>
--password <password>
--api-key <key>
```

Example:

```bash
flag3 tui \
  --host localhost \
  --port 3000 \
  --username flag3 \
  --password flag3
```

Settings are persisted in
`$XDG_CONFIG_HOME/flagflagflag/settings.json`, or
`~/.config/flagflagflag/settings.json` when `XDG_CONFIG_HOME` is unset. Override
the path with `FLAGFLAGFLAG_CONFIG`.

Run the connection wizard directly:

```bash
flag3 config
```

The wizard stores host, port, username/password, and SDK API key locally. The
file is created with `0700` parent-directory and `0600` file permissions.
Credentials are stored locally in plaintext; protect the account and
configuration directory accordingly.

Command-line options override environment variables, which override saved
settings. `FLAGFLAGFLAG_URL` overrides the host and port pair. Host and port
default to `localhost` and `3000`; credentials have no hard-coded default.

## Commands

```text
flag3 config
flag3 tui [connection options]
flagflagflag wizard [connection options]
flagflagflag is-enabled <name> --project-id <id> --environment <name>
flagflagflag project create <name>
flagflagflag environment create <project-id> <name>
flagflagflag flag create <name> --project-id <id> --environment <name> [--enabled]
```

The direct commands are intentionally small. Full list, update, and delete
workflows live in the TUI so the selected project and environment remain visible
while records are changed.

## Ember Console TUI

The dashboard is implemented in `src/dashboard.tsx` and uses Ink with
`ink-text-input` for forms. Its visual language is deliberately terminal-native:

- charcoal background supplied by the user's terminal,
- ember and coral accents for active navigation and headings,
- muted gray metadata and dividers,
- green success output and yellow confirmation prompts,
- a left navigation rail for Projects, Environments, and Flags.

Keyboard controls:

```text
↑↓ / j,k  Move through records
Tab       Switch resource section
n         Create the selected resource
e         Edit the selected record
d         Start delete confirmation
y / n     Confirm or cancel deletion
r         Refresh records
q / Esc   Exit
```

Project selection scopes the environment list. Environment selection scopes the
flag list. Flags are evaluated by project ID plus environment name, matching the
server contract.

## API boundary

`src/api-client.ts` owns transport and authentication. `FlagApi` is the public
seam consumed by both the wizard and dashboard, which keeps Ink components
independent of `fetch` and makes them testable with in-memory implementations.

The client supports CRUD operations for:

- projects: list, create, update, delete;
- environments: list, create, update, delete;
- flags: list, create, update, delete;
- flag evaluation through `isEnabled`.

The server currently exposes these resource routes:

```text
GET/POST              /projects
GET/PATCH/DELETE      /projects/:id
GET/POST              /projects/:projectId/environments
GET/PATCH/DELETE      /projects/:projectId/environments/:id
GET/POST              /feature-flags
GET/PATCH/DELETE      /feature-flags/:name?projectId=:id&environment=:name
```

## Tests

Tests cover the two public seams:

- `src/cli.test.ts`: command routing and output.
- `src/app.test.tsx`: wizard transitions and API calls.
- `src/dashboard.test.tsx`: dashboard rendering and keyboard-driven creation.

Use `ink-testing-library` for component tests. Test visible frames and calls at
the `FlagApi` boundary; do not mock Ink internals.
