# Use one shared deterministic evaluator

Status: accepted

The server, Node SDK, and SDK Configuration use the same evaluator contract for disabled flags, ordered targeting rules, defaults, and percentage rollouts. Percentage assignment is deterministic from environment, flag, and caller identity rather than random per evaluation, so a decision remains consistent across processes and refreshes. This prevents semantic drift between remote evaluation and local SDK evaluation while keeping the evaluator dependency-free and reusable.
