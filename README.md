# flagflagflag

A TypeScript monorepo for managing and evaluating feature flags. The repository currently contains a NestJS feature-flag server, a shared evaluation library, a Node.js SDK, and an Ink-based terminal CLI.

## Current status

The project is an early, private `0.0.1` implementation. The working feature set includes:

- Projects, each with isolated environments.
- Feature-flag CRUD scoped by project and environment.
- Boolean enable/disable state and a `0`–`100` percentage rollout.
- Attribute-based targeting rules with equality, membership, containment, and numeric comparison operators.
- Anonymous flag evaluation endpoints returning the stable `{ "enabled": boolean }` shape.
- Username/password authentication with JWT sessions for protected management routes.
- SQLite by default, with PostgreSQL selected through `DATABASE_URL`.
- Versioned, environment-scoped SDK configuration with ETag support.
- A Node SDK that refreshes configuration, evaluates flags locally, and returns evaluation reasons.
- A terminal CLI with an interactive CRUD dashboard, setup wizard, and direct project, environment, flag, and evaluation commands.

The server's SDK key service can create and validate environment-scoped keys. A public key-management HTTP workflow is not currently documented; SDK configuration requests require a key issued by the server implementation.

## Repository layout

```text
packages/
├── server/      NestJS API, persistence, authentication, and SDK config endpoint
├── evaluator/   Shared, dependency-free flag evaluation logic and contracts
├── node-sdk/    Node.js client with cached local evaluation and refresh
└── cli/         Ink terminal dashboard, wizard, and direct commands
```

## Prerequisites

- Node.js with `pnpm` enabled.
- A current TypeScript-compatible Node.js runtime.

Install all workspace dependencies from the repository root:

```bash
pnpm install
```

There is no root package script. Run package scripts from the package that owns the behavior, or use `pnpm --dir packages/<package> <script>`.

## Packages

### `@flagflagflag/server`

The server is a NestJS API backed by TypeORM. It owns projects, environments, feature flags, authentication, database initialization, and the SDK configuration endpoint.

Start it from the package directory:

```bash
cd packages/server
pnpm start:dev
```

The default listener is `http://localhost:3000`. `PORT` changes the port.

Database configuration:

- SQLite is the default and uses `./flagflagflag.sqlite`.
- Set `SQLITE_DATABASE=./data/flagflagflag.sqlite` to choose another SQLite file.
- Set `DATABASE_URL=postgres://user:password@localhost:5432/flagflagflag` to use PostgreSQL.
- Set a strong `JWT_SECRET` outside local development.

The local development seed account is `flag3` / `flag3`. Change it before exposing the server outside local development. See [`packages/server/docs/AUTH.md`](packages/server/docs/AUTH.md) for authentication details.

Useful commands:

```bash
cd packages/server
pnpm build
pnpm test
pnpm test:e2e
pnpm lint
```

#### Server API

Protected management routes use the JWT returned by `/api/auth/sign-in/username`, either as a session cookie or `Authorization: Bearer <token>`.

Authentication:

```text
POST /api/auth/sign-in/username
POST /api/auth/sign-up/email
POST /api/auth/change-password
```

Projects:

```text
GET/POST              /projects
GET/PATCH/DELETE      /projects/:id
```

Environments:

```text
GET/POST              /projects/:projectId/environments
GET/PATCH/DELETE      /projects/:projectId/environments/:id
```

Feature flags:

```text
GET/POST              /feature-flags
GET/PATCH/DELETE      /feature-flags/:name?projectId=:id&environment=:name
POST                  /feature-flags/:name/evaluate
GET                   /feature-flags/:name?projectId=:id&environment=:name
```

The evaluation routes are anonymous. `POST` accepts `projectId`, `environment`, and a flat `attributes` object. Both evaluation routes return `{ "enabled": boolean }`.

Targeting rules currently support:

- `equals` and `notEquals` for scalar values.
- `in` for string arrays.
- `contains` for strings.
- `greaterThan`, `greaterThanOrEqual`, `lessThan`, and `lessThanOrEqual` for numbers.

Rules are evaluated in request order and all conditions in a rule must match. The server limits a flag to 20 targeting rules. Percentage rollout is restricted to `0`–`100`.

### `@flagflagflag/evaluator`

The evaluator is the shared local decision engine used by the server's SDK configuration format and the Node SDK. It has no runtime dependencies.

Build and test it with:

```bash
cd packages/evaluator
pnpm build
pnpm test
```

Public API:

```ts
import { evaluateFlag } from '@flagflagflag/evaluator';

const result = evaluateFlag(flag, { userId: 'user-123', plan: 'pro' });
// { value: boolean, reason: 'RULE_MATCH' | 'ROLLOUT_MATCH' | ... }
```

The exported contracts include `FlagConfig`, `SdkConfig`, `EvaluationContext`, and `EvaluationResult`. Results identify whether the decision came from a disabled flag, matching rule, rollout, default value, missing flag, or missing configuration.

Rules are sorted by ascending priority. When a percentage rollout is configured, the evaluator hashes `flag key + userId` for a stable bucket; rollout evaluation requires a string or numeric `userId`.

### `@flagflagflag/node-sdk`

The Node SDK downloads an environment-scoped configuration from `/sdk/v1/config`, evaluates flags in the application process, and continues using the last valid configuration when refreshes fail.

Build and test it with:

```bash
cd packages/node-sdk
pnpm build
pnpm test
```

Example:

```ts
import { FlagsClient } from '@flagflagflag/node-sdk';

const client = new FlagsClient({
  sdkKey: process.env.FLAGFLAGFLAG_SDK_KEY!,
  baseUrl: 'http://localhost:3000',
});

await client.initialize();

const enabled = client.isEnabled('new-checkout', { userId: 'user-123' });
const decision = client.evaluate('new-checkout', { userId: 'user-123' });

client.close();
```

`FlagsClient` supports:

- `initialize()` for the initial fetch and automatic refresh scheduling.
- `refresh()` for an explicit refresh; concurrent refresh calls are coalesced.
- `evaluate()` for a detailed `EvaluationResult`.
- `isEnabled()` for a boolean result.
- `close()` to stop the refresh timer.
- `refreshIntervalMs` customization, defaulting to 30 seconds.
- ETag-based conditional requests.
- Defensive response validation and fallback behavior when there is no configuration, a flag is missing, the response is invalid, or the network request fails.

The SDK authenticates with `Authorization: Bearer <sdkKey>`. SDK keys are environment-scoped, so the returned configuration contains only flags for the authenticated environment.

### `@flagflagflag/cli`

The CLI is an Ink-based terminal control surface for the server. It publishes both `flag3` and `flagflagflag` binaries; `flag3` is the preferred short command.

Build, test, and run it with:

```bash
cd packages/cli
pnpm build
pnpm test
pnpm start --help
```

Commands:

```text
flag3 config
flag3 tui [connection options]
flagflagflag wizard [connection options]
flagflagflag is-enabled <name> --project-id <id> --environment <name>
flagflagflag project create <name>
flagflagflag environment create <project-id> <name>
flagflagflag flag create <name> [<percentage>%] [ON|OFF] --project-id <id> --environment <name>
flagflagflag flag <name> <percentage>% <ON|OFF> --project-id <id> --environment <name>
```

Connection options include `--host`, `--port`, `--username`, `--password`, and `--api-key`. Defaults are `localhost:3000`; command-line options override environment variables, which override saved settings. `FLAGFLAGFLAG_URL` can override the host/port pair.

The TUI supports project, environment, and flag list/create/edit/delete workflows. Its keyboard controls include `↑↓` or `j/k` for navigation, `Tab` for sections, `n` for create, `e` for edit/toggle, `d` then `y/n` for deletion confirmation, `r` for refresh, and `q` or `Esc` to exit.

Settings are stored at `$XDG_CONFIG_HOME/flagflagflag/settings.json`, or `~/.config/flagflagflag/settings.json` by default. `FLAGFLAGFLAG_CONFIG` overrides that path. The file contains credentials in plaintext and should be protected.

## SDK HTTP contract

The server exposes the configuration endpoint consumed by the Node SDK:

```text
GET /sdk/v1/config
Authorization: Bearer <sdk-key>
```

Response shape:

```json
{
  "version": 1,
  "environment": "staging",
  "flags": {
    "new-checkout": {
      "key": "new-checkout",
      "enabled": true,
      "defaultValue": false,
      "rolloutPercentage": 25,
      "rules": []
    }
  }
}
```

The endpoint returns an `ETag` derived from the configuration version and responds with `304 Not Modified` when the client sends a matching `If-None-Match` header.

## Development workflow

1. Install dependencies with `pnpm install`.
2. Start the server from `packages/server`.
3. Use the CLI or authenticated HTTP requests to create projects, environments, and flags.
4. Build and test the affected package.
5. Run server end-to-end tests when changing an HTTP contract.

Package-specific source tests live beside the implementation. Server end-to-end tests are in [`packages/server/test`](packages/server/test).

## Related documentation

- [Server authentication](packages/server/docs/AUTH.md)
- [CLI implementation and controls](packages/cli/README.md)
- [Domain terminology](CONTEXT.md)
- [Production API contract decision](docs/adr/0001-production-api-contract.md)
