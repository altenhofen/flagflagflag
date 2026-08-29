# Keep the CLI behind a Flag API boundary

Status: accepted

The terminal CLI separates Ink presentation and command orchestration from server transport through the `FlagApi` contract. The Dashboard and Setup Wizard depend on that seam rather than `fetch`, allowing interactive workflows to share the same resource vocabulary while remaining testable with in-memory implementations. Direct commands remain intentionally narrow; the Dashboard owns the richer CRUD interaction.
