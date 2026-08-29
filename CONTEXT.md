# Feature Flag Context

This context defines feature flags, their evaluation inputs, and the targeting behavior used to decide whether a flag is enabled.

## Language

**Feature Flag**:
A named boolean capability scoped to one project environment, with optional percentage rollout and targeting rules.
_Avoid_: Toggle, switch

**Feature Flag Evaluation**:
The decision process that determines whether a Feature Flag is enabled for an Evaluation Context, including enabled state, Targeting Rules, and Percentage Rollout.

**Project**:
A namespace that owns environments and the feature flags configured within them.
_Avoid_: Application, account

**Environment**:
A project-specific deployment context such as development, staging, or production. Feature flag state is isolated between environments.
_Avoid_: Stage, context

**Evaluation Context**:
The caller-provided flat set of attributes used to evaluate targeting rules for a feature flag.
_Avoid_: User object, metadata

**Targeting Rule**:
A predicate containing an attribute, operator, and comparison value. A flag's flat rule list matches only when every rule matches the evaluation context.
_Avoid_: Condition, filter

**Operator**:
A closed comparison kind supported by a targeting rule, such as equality, membership, containment, or numeric comparison.
_Avoid_: Comparator, expression

**Percentage Rollout**:
A probabilistic restriction applied after the flag is enabled and its targeting rules match.
_Avoid_: Traffic split, gradual rollout
