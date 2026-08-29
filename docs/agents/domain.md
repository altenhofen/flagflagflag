# Domain Docs

How engineering skills should consume this repository's domain documentation.

## Before exploring, read these

- `CONTEXT.md` at the repository root
- `docs/adr/` for ADRs touching the area being explored

If these files do not exist, proceed silently. The domain-modeling skill creates them lazily when domain terms or decisions are resolved.

## File structure

This is a single-context repository:

```text
/
├── CONTEXT.md
├── docs/adr/
└── src/
```

## Use the glossary's vocabulary

When output names a domain concept, use the term defined in `CONTEXT.md`. If a required concept is absent, treat that as a domain-modeling signal.
