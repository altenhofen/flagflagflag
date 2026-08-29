# Repository instructions

## Repository shape

This repository contains three packages:

- `flagflagflag-server/`: NestJS API, Better Auth, SQLite/PostgreSQL persistence.
- `flagflagflag-ts-sdk/`: browser/Node-compatible TypeScript feature-flag client.
- `flagflagflag-cli/`: Ink-based interactive CLI and feature-flag commands.

Run package commands from the package directory. Keep changes scoped to the package
that owns the behavior.

## Engineering workflow

1. Read the target files and the nearest tests before editing.
2. Preserve the existing TypeScript and NestJS patterns.
3. Make the smallest complete change; remove obsolete code when moving behavior.
4. Add or update a behavioral test for every new API contract.
5. Run the affected package build and tests before finishing.
6. Commit all changes before finishing.
Use explicit contracts at HTTP boundaries. Keep persistence, validation, and
transport responsibilities separate.

## TypeScript conventions

- ESM imports include the `.js` extension.
- TypeScript is strict and uses NodeNext module resolution.
- Use single quotes and trailing commas, matching `.prettierrc`.
- Use `import type` for types used by decorated signatures.
- Prefer named interfaces/types for exported contracts.
- Validate untrusted input at the boundary before using it.
- Keep domain methods small and deterministic; avoid speculative abstractions.

## `flagflagflag-server/src`

`app.module.ts` is the composition root. Register modules, controllers, providers,
and cross-cutting infrastructure there.

`app.controller.ts` owns only application-level routes such as the root response.
Feature behavior belongs in its feature folder.

`main.ts` owns process bootstrap. Better Auth requires Nest's body parser to be
disabled because the Better Auth integration installs the required parsers.

## `flagflagflag-server/src/auth`

This folder owns Better Auth configuration, database initialization, and the
default-user seed.

- Use Better Auth APIs for credentials, sessions, password changes, and signup.
- Keep auth configuration in `auth.ts`.
- Keep seed behavior in `auth-seed.service.ts`.
- Put auth request/data schemas in `schemas.ts` and validate with Zod.
- Keep the local default credentials documented in `flagflagflag-server/docs/AUTH.md`.
- Never expose password hashes or internal account data in API responses.
- Review authentication changes against the Better Auth integration docs.

The default local account is `flag3` / `flag3`. Treat it as development-only.

## `flagflagflag-server/src/feature_flag`

This folder owns feature flag routes, domain behavior, and feature flag schemas.

- `feature-flag.controller.ts` owns HTTP routes.
- `feature-flag.service.ts` owns flag state and domain operations.
- `schemas.ts` owns Zod request schemas.
- Feature flag reads are anonymous for the current SDK contract.
- Feature flag creation is authenticated through the global Better Auth guard.
- Return `{ enabled: boolean }` from flag evaluation so the SDK contract remains stable.
- Reject malformed requests with a NestJS `BadRequestException` containing the
  Zod issues.

Feature flag state is stored in the database. Projects own environments, and
feature flags reference environments.

## `flagflagflag-server/migrations`

All backend database migrations belong here, including Better Auth schema migrations.
Do not create parallel migration directories. Keep migration files reviewed and
compatible with both the configured SQLite and PostgreSQL targets.

The application initializes the early Better Auth schema on startup; migration
files remain the versioned database record.

## `flagflagflag-server/test` and source tests

- Unit tests live beside the source they exercise.
- End-to-end tests live in `flagflagflag-server/test`.
- Test observable HTTP behavior: status, response shape, authentication, and
  state transitions.
- Use isolated temporary databases when testing fresh-database behavior.
- Run:

```bash
cd flagflagflag-server
pnpm build
pnpm test
pnpm test:e2e
```

## `flagflagflag-ts-sdk`

The SDK exposes a small public surface:

```ts
await client.isEnabled('feature-name');
```

The client configuration supplies the project and environment context for
evaluation.

- Keep flag names as strings until the server contract supports generated typing.
- `isEnabled` is asynchronous because it performs HTTP I/O.
- Send the configured API key as `X-API-Key`.
- Treat network errors, non-success responses, malformed responses, and unknown
  flags as disabled (`false`).
- Keep the response parser defensive; only accept `{ enabled: boolean }`.
- Build with the TypeScript compiler configured by `flagflagflag-ts-sdk/tsconfig.json`.

The SDK and server endpoint contract is:

```text
GET /feature-flags/:name?projectId=:projectId&environment=:environment
→ { "enabled": boolean }
```

## `flagflagflag-cli`

The CLI uses Ink for its interactive wizard and the renamed TypeScript SDK for
flag evaluation. Keep API access behind the `FlagApi` interface so the wizard
and command runner remain testable at their public seams.

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues; use the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

This is a single-context repository with one root `CONTEXT.md` and root `docs/adr/`. See `docs/agents/domain.md`.
