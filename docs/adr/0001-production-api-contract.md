# Production API contract and evaluation model

Status: accepted

The repository is moving from an early local API to a versioned, production-oriented HTTP contract. The new contract uses explicit API versioning, nested project/environment resources, stable flag keys, one shared evaluation model, deterministic percentage rollout, consistent errors, and separately scoped user, SDK, and runtime evaluation credentials. This is a breaking cutover: new implementation work should target `/api/v1`; compatibility shims for the current routes are not required.

## Decision

### 1. Version and resource hierarchy

All public HTTP routes use the `/api/v1` prefix:

```text
/api/v1/auth/*
/api/v1/projects/*
/api/v1/evaluate
/api/v1/evaluate/batch
/api/v1/sdk/config
```

Projects own environments. Environments own feature flags. Resource ownership is expressed in the path, not duplicated in query parameters or request bodies.

```text
GET    /api/v1/projects
POST   /api/v1/projects
GET    /api/v1/projects/:projectId
PATCH  /api/v1/projects/:projectId
DELETE /api/v1/projects/:projectId

GET    /api/v1/projects/:projectId/environments
POST   /api/v1/projects/:projectId/environments
GET    /api/v1/projects/:projectId/environments/:environmentId
PATCH  /api/v1/projects/:projectId/environments/:environmentId
DELETE /api/v1/projects/:projectId/environments/:environmentId

GET    /api/v1/projects/:projectId/environments/:environmentId/flags
POST   /api/v1/projects/:projectId/environments/:environmentId/flags
GET    /api/v1/projects/:projectId/environments/:environmentId/flags/:flagKey
PATCH  /api/v1/projects/:projectId/environments/:environmentId/flags/:flagKey
DELETE /api/v1/projects/:projectId/environments/:environmentId/flags/:flagKey
```

Use generated immutable IDs for projects and environments. Use an immutable machine-readable `flagKey` as the feature flag identity. If a human display label is needed, store it separately as `name`; never use a mutable display name as a path identifier.

Flag keys should be validated as bounded slugs, for example:

```text
^[a-z0-9][a-z0-9._-]{0,99}$
```

### 2. Flag representation

Create requests contain only flag data because project and environment are already represented by the route:

```json
{
  "key": "new-checkout",
  "name": "New checkout",
  "enabled": true,
  "defaultValue": false,
  "rollout": {
    "percentage": 25,
    "attribute": "userId"
  },
  "rules": []
}
```

`rollout` is either `null` or an object. `percentage` is an integer from 0 through 100. `attribute` identifies the stable evaluation-context attribute used for bucketing. Do not use an omitted percentage and `100` as two representations of the same state.

`PATCH` is genuinely partial: every mutable property is optional. Use `PUT` only for complete replacement if that operation is later needed.

### 3. One canonical evaluation model

The server, shared evaluator, SDK configuration, and Node SDK must evaluate the same flag configuration with the same semantics.

A targeting rule has an explicit result/variation and one or more conditions:

```json
{
  "id": "rule-1",
  "priority": 10,
  "result": true,
  "conditions": [
    { "attribute": "plan", "operator": "equals", "value": "pro" },
    { "attribute": "country", "operator": "in", "value": ["US", "CA"] }
  ]
}
```

Evaluation semantics:

1. Sort rules by ascending `priority`.
2. Conditions inside one rule use AND semantics.
3. The first matching rule determines the result.
4. If no rule matches, evaluate the deterministic rollout when configured.
5. If no rollout is configured, return `defaultValue`.
6. A disabled flag returns false before rules or rollout are evaluated.
7. A missing flag or missing configuration returns the caller's fallback in SDK interfaces and a documented false/default result in HTTP interfaces.

The operator vocabulary is one shared contract used by server validation and evaluator code:

```text
equals
notEquals
in
notIn
contains
greaterThan
greaterThanOrEqual
lessThan
lessThanOrEqual
```

The shared evaluator owns the implementation. Server and SDK code must not maintain independent operator switches or string-normalization fallbacks. An unknown operator is invalid configuration and must fail validation; it must never silently become `equals`.

Operator value constraints remain explicit:

- `equals` and `notEquals`: scalar values.
- `in` and `notIn`: non-empty string arrays.
- `contains`: a string value.
- Numeric operators: finite numeric values.

### 4. Deterministic rollout

Percentage rollout is deterministic across server and SDK evaluation. Compute a stable bucket from the environment identity, flag key, and configured context identifier:

```text
bucket = hash(environmentId + ":" + flagKey + ":" + String(context[rollout.attribute])) % 100
```

A bucket below `rollout.percentage` is enabled. The configured rollout attribute must resolve to a string or number. If it does not, return the documented default/miss result consistently in every evaluator.

Do not use `Math.random()` for production flag evaluation. The same input must produce the same result across repeated evaluations and processes.

### 5. Runtime evaluation routes

Use one structured evaluation route instead of separate GET and POST flag-specific evaluation routes:

```text
POST /api/v1/evaluate
POST /api/v1/evaluate/batch
```

Single evaluation request:

```json
{
  "projectId": "project-id",
  "environmentId": "environment-id",
  "flagKey": "new-checkout",
  "context": {
    "userId": "user-123",
    "plan": "pro"
  },
  "fallback": false
}
```

Single evaluation response:

```json
{
  "flagKey": "new-checkout",
  "value": true,
  "reason": "RULE_MATCH",
  "matchedRuleId": "rule-1",
  "configVersion": 42
}
```

Batch evaluation request:

```json
{
  "projectId": "project-id",
  "environmentId": "environment-id",
  "context": { "userId": "user-123" },
  "flags": ["new-checkout", "new-navigation"]
}
```

Batch responses contain a result per requested flag. Runtime evaluation may remain anonymously callable for the client contract, but it must have rate limiting, bounded request sizes, and an explicit abuse/security policy. Do not expose sensitive targeting data or internal rule details in public responses unless the caller is authorized.

### 6. SDK configuration

The Node SDK consumes:

```text
GET /api/v1/sdk/config
X-SDK-Key: <environment-scoped-key>
If-None-Match: "<config-version>"
```

The configuration response is:

```json
{
  "schemaVersion": 1,
  "configVersion": 42,
  "environment": {
    "id": "environment-id",
    "key": "staging"
  },
  "flags": {
    "new-checkout": {
      "key": "new-checkout",
      "enabled": true,
      "defaultValue": false,
      "rollout": {
        "percentage": 25,
        "attribute": "userId"
      },
      "rules": []
    }
  }
}
```

`schemaVersion` identifies the configuration format. `configVersion` changes when the environment's effective flag configuration changes. Return `ETag: "<configVersion>"` and `304 Not Modified` for a matching `If-None-Match`. Also send `Cache-Control: private, max-age=30` unless deployment policy requires a different value.

The SDK key is not a user session. Use `X-SDK-Key` for SDK configuration requests and reserve cookies/bearer access tokens for user authentication and management APIs.

### 7. SDK key management

Expose environment-scoped SDK key management through authenticated management routes:

```text
GET    /api/v1/projects/:projectId/environments/:environmentId/sdk-keys
POST   /api/v1/projects/:projectId/environments/:environmentId/sdk-keys
DELETE /api/v1/projects/:projectId/environments/:environmentId/sdk-keys/:keyId
```

Create returns the secret exactly once:

```json
{
  "id": "key-id",
  "prefix": "abc12345",
  "key": "secret-shown-once",
  "environmentId": "environment-id",
  "createdAt": "2026-08-29T12:00:00Z"
}
```

Persist only a hash of the secret. Never return the secret after creation. Revocation makes subsequent SDK requests fail with `401`. Audit creation and revocation.

### 8. User authentication

Use implementation-neutral authentication route names:

```text
POST /api/v1/auth/login
POST /api/v1/auth/register
POST /api/v1/auth/password
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

Browser clients may use secure HTTP-only same-site cookies. CLI and automation clients may use bearer access tokens. These are user credentials and must remain distinct from SDK keys.

Login responses must not expose password hashes or internal account data:

```json
{
  "accessToken": "...",
  "tokenType": "Bearer",
  "expiresAt": "2026-08-29T06:35:00.022Z",
  "user": {
    "id": "user-id",
    "username": "flag3",
    "email": "flag3@example.com",
    "name": "Flag Three"
  }
}
```

### 9. Errors

Every endpoint uses one stable Problem Details-style error shape:

```json
{
  "type": "https://docs.flagflagflag.dev/errors/validation",
  "title": "Request validation failed",
  "status": 400,
  "code": "VALIDATION_ERROR",
  "detail": "One or more request fields are invalid.",
  "instance": "/api/v1/projects",
  "requestId": "req_01J...",
  "errors": [
    {
      "field": "name",
      "code": "too_small",
      "message": "Expected at least 1 character"
    }
  ]
}
```

Clients branch on the stable `code`, not human-readable messages. At minimum support:

```text
VALIDATION_ERROR
AUTHENTICATION_REQUIRED
AUTHENTICATION_FAILED
FORBIDDEN
NOT_FOUND
CONFLICT
PRECONDITION_FAILED
RATE_LIMITED
INTERNAL_ERROR
```

Required status semantics:

```text
201 Created       resource creation
200 OK            successful reads and updates
204 No Content    successful deletes
400 Bad Request  malformed input
401 Unauthorized missing or invalid credentials
403 Forbidden    authenticated but not permitted
404 Not Found    missing resource
409 Conflict     uniqueness or state conflict
412 Precondition Failed failed version/ETag check
429 Too Many Requests rate limit exceeded
503 Service Unavailable unavailable dependency/configuration
```

### 10. Collections and concurrency

Collection endpoints return an envelope so pagination and metadata can evolve without changing the top-level type:

```json
{
  "data": [],
  "pagination": {
    "nextCursor": null
  }
}
```

Support bounded cursor pagination for flags and future large collections:

```text
?limit=50&cursor=<opaque>&sort=name&order=asc
```

Mutating endpoints support `Idempotency-Key` where duplicate creation is possible. Resource updates use ETags with `If-Match`, or an equivalent explicit expected-version field, so concurrent writes do not silently overwrite one another.

## Implementation order

1. Extract shared evaluator contracts and schemas.
2. Make server evaluation and the Node SDK use the same evaluator and rule semantics.
3. Add boundary tests proving identical results for rules, operators, rollouts, defaults, missing identifiers, and disabled flags.
4. Add `/api/v1` routes with nested project/environment/flag ownership.
5. Migrate flag identity from mutable `name` paths to stable keys and IDs.
6. Replace separate evaluation routes with single and batch evaluation contracts.
7. Add the versioned SDK configuration response, dedicated SDK key header, and key-management routes.
8. Standardize errors, request IDs, pagination, rate limits, idempotency, and optimistic concurrency.
9. Update the Node SDK, CLI, README, and all HTTP tests to the new contract.
10. Remove obsolete routes, mappings, and compatibility code after the cutover.

## Acceptance criteria

Implementation is complete only when:

- Every public route is under `/api/v1`.
- Project/environment ownership is represented by nested paths.
- Flag keys are stable and display names are not used as resource identity.
- Server and SDK evaluation produce identical results for the same configuration and context.
- The operator vocabulary and schema are shared, with no silent fallback for unknown operators.
- Rollout decisions are deterministic and use the same bucketing algorithm everywhere.
- SDK keys are environment-scoped, hashed at rest, shown once, and revocable.
- SDK configuration supports `schemaVersion`, `configVersion`, ETags, and `304` responses.
- Errors have a stable machine-readable code and request ID.
- Collections are bounded and pagination-ready.
- Update concurrency and duplicate creation behavior are explicit.
- Contract, unit, and end-to-end tests cover the new observable behavior.
