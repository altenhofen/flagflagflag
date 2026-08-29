# Feature Flag Context

This context defines the domain language for managing boolean capabilities, evaluating them against caller attributes, and delivering environment-scoped configuration to local consumers.

## Core model

**Project**:
A namespace that owns a set of isolated Environments.
_Avoid_: Application, account

**Environment**:
A named deployment context within a Project, such as development, staging, or production, whose flag state and SDK configuration are isolated from other Environments.
_Avoid_: Stage, context

**Feature Flag**:
A named boolean capability belonging to one Environment, with a default value and optional rollout or targeting behavior.
_Avoid_: Toggle, switch

**Flag Key**:
The immutable machine-readable identifier of a Feature Flag.
_Avoid_: Display name, label

**Configuration Version**:
The monotonically increasing revision that identifies the current SDK-visible configuration of an Environment.
_Avoid_: Flag version, deployment version

## Evaluation

**Evaluation Context**:
The caller-provided flat set of attributes used to evaluate a Feature Flag.
_Avoid_: User object, metadata

**Evaluation Decision**:
The boolean result and reason produced when a Feature Flag is evaluated for an Evaluation Context.
_Avoid_: Remote response, flag state

**Targeting Rule**:
An ordered predicate that returns an explicit boolean result when all of its Conditions match an Evaluation Context.
_Avoid_: Filter, rule condition

**Condition**:
One attribute comparison inside a Targeting Rule.
_Avoid_: Targeting rule, constraint

**Targeting Operator**:
A supported comparison kind for a Condition, including equality, membership, containment, and numeric comparisons.
_Avoid_: Comparator, expression

**Percentage Rollout**:
A deterministic restriction that assigns a stable subset of Evaluation Contexts to a Feature Flag after targeting rules have been considered.
_Avoid_: Random toggle, traffic split

**Fallback**:
The caller-selected boolean returned when configuration or the requested Feature Flag is unavailable.
_Avoid_: Default value

## SDK delivery

**SDK Configuration**:
A complete, validated snapshot of one Environment's Feature Flags consumed by an SDK for local evaluation.
_Avoid_: Runtime response, remote evaluation

**SDK Key**:
A secret credential bound to exactly one Environment and used by an SDK to retrieve its SDK Configuration.
_Avoid_: User token, API key

**Last-Known-Good Configuration**:
The most recent valid SDK Configuration retained when a later retrieval fails or is invalid.
_Avoid_: Cached response, stale response

**Configuration Invalidation**:
A notification that an Environment may have a newer Configuration Version; it is not an Evaluation Decision or a configuration payload.
_Avoid_: Flag event, remote evaluation

## Access and clients

**User Session**:
A time-limited credential representing a human or automation identity authorized to manage Projects, Environments, and Feature Flags.
_Avoid_: SDK key, flag credential

**Runtime Evaluation**:
A server-side evaluation request that returns a decision for a supplied Project, Environment, Feature Flag, and Evaluation Context.
_Avoid_: SDK evaluation, configuration fetch

**Flag API**:
The CLI's transport boundary for project, environment, flag, and evaluation operations.
_Avoid_: UI state, SDK client

**Dashboard**:
The interactive CLI surface for browsing and changing Projects, Environments, and Feature Flags.
_Avoid_: Admin portal, server UI

**Setup Wizard**:
The guided CLI flow that creates a Project, Environment, and optional Feature Flag.
_Avoid_: Dashboard, migration
