# Code an Issue: GitHub Workflow

This guide describes the workflow from creating a GitHub issue through implementation, review, and merge.

## 1. Prerequisites

Before creating or coding an issue:

- Read the repository `AGENTS.md` and relevant package instructions.
- Confirm the issue has a clear end-to-end goal and acceptance criteria.
- Identify dependencies and state them in a `Blocked by` section.
- Use the repository's configured triage label, such as `ready-for-agent`.
- Confirm the GitHub remote and that `gh` is authenticated:

```bash
git remote -v
gh auth status
```

For a multi-session feature, first refine the idea into a spec, split it into vertical tickets, and publish the tickets in dependency order. Do not triage tickets that were already produced by the ticket-splitting workflow.

## 2. Create the issue

Create one issue per independently verifiable vertical slice:

```bash
gh issue create \
  --title "Short implementation title" \
  --label ready-for-agent \
  --body-file /path/to/issue-body.md
```

Use this structure for the body:

```markdown
## What to build

Describe the complete user-visible or API-visible behavior.

## Acceptance criteria

- [ ] Observable behavior one
- [ ] Observable behavior two
- [ ] Required behavioral tests

## Blocked by

- None (can start immediately)
```

Keep acceptance criteria behavioral. Avoid prescribing stale file paths or implementation details unless they encode an important contract.

Read the created issue back before implementation:

```bash
gh issue view ISSUE_NUMBER --comments
```

## 3. Select an unblocked issue

Work the dependency frontier:

- An issue with no blockers can start immediately.
- A blocked issue starts only after every listed blocker is merged.
- Do not merge dependent work against an old base branch.
- Do not close or modify a parent issue when implementing a child ticket.

Useful commands:

```bash
gh issue list --state open --label ready-for-agent
```

## 4. Create an isolated worktree

A worktree is recommended when working on multiple issues simultaneously. The implementation skills operate in the current checkout; they do not automatically create or coordinate worktrees.

Create one branch and one worktree per issue:

```bash
git fetch origin
git worktree add ../repo-issue-N \
  -b issue-N-short-name \
  origin/main
```

Replace `origin/main` with the repository's integration branch if different.

Open a terminal in that worktree:

```bash
cd ../repo-issue-N
```

Rules:

- Never implement two issues in the same checkout at the same time.
- Keep each worktree on its own branch.
- Do not share development databases or generated state between worktrees.
- Avoid editing files outside the issue's scope.
- If only one issue is being implemented sequentially, the existing checkout is sufficient.

## 5. Implement the issue

Start implementation from the issue and its repository context:

```text
/implement N
```

The implementation workflow should:

1. Read the issue and relevant source, tests, context, and ADRs.
2. Inspect existing API contracts and callsites before changing exported behavior.
3. Build one red-green behavior slice at a time, using TDD where practical.
4. Keep changes scoped to the owning package.
5. Add or update behavioral tests for new observable contracts.
6. Run affected typechecks, builds, and tests during development.
7. Run the required package verification before finishing.
8. Run the standards/spec review before opening the PR.
9. Commit the completed work to the issue branch.

If the implementation is not yet committed:

```bash
git status
git add -A
git commit -m "Implement #N: short description"
```

Do not commit secrets, local databases, build output, or unrelated formatting changes.

## 6. Verify the branch

Before opening a PR, inspect the branch and run the commands required by the repository instructions:

```bash
git status
git log -1 --oneline
```

For the server package, the standard checks are:

```bash
cd packages/server
pnpm build
pnpm test
pnpm test:e2e
```

Run the relevant checks for other packages as documented by their package instructions. Also exercise the changed behavior directly when a smoke test or running application is available.

Record the verification commands and results in the PR description. A failed check must be fixed or explicitly explained before merge.

## 7. Review the change

Run the code review workflow against the issue and current diff:

```text
/code-review
```

The review checks two things:

- **Standards:** repository conventions, package boundaries, tests, security, and maintainability.
- **Spec:** every issue requirement and acceptance criterion is implemented.

Fix findings in the same worktree, rerun affected checks, commit the fixes, and push again.

## 8. Push and open the pull request

Push the issue branch:

```bash
git push -u origin issue-N-short-name
```

Create a PR that links exactly one issue:

```bash
gh pr create \
  --base main \
  --head issue-N-short-name \
  --title "Implement #N: Short description" \
  --body-file /path/to/pr-body.md
```

Use a PR body like:

```markdown
## What changed

Describe the end-to-end behavior implemented.

## Verification

- `command` — passed
- `command` — passed

## Review notes

Mention important tradeoffs, API compatibility details, or known limitations.

Closes #N
```

The PR should contain the issue's complete vertical slice: implementation, tests, validation, and relevant UI/API behavior. Do not combine unrelated tickets into one PR.

## 9. Review and merge the PR

After opening the PR:

1. Confirm CI passes.
2. Review the rendered diff and changed files.
3. Resolve review comments in the issue branch.
4. Push fixes and rerun affected checks.
5. Obtain the required approval.
6. Confirm the PR still targets the current integration branch.
7. Merge the PR using the repository's normal GitHub merge policy.

Example:

```bash
gh pr checks PR_NUMBER
gh pr view PR_NUMBER
```

Merge only after the acceptance criteria, tests, review, and CI are complete. The linked issue should close through `Closes #N`; verify that it did.

## 10. Start the next frontier

After merging a blocker:

```bash
git fetch origin
gh issue list --state open --label ready-for-agent
```

Start newly unblocked issues from the updated base branch:

```bash
git worktree add ../repo-issue-N \
  -b issue-N-short-name \
  origin/main
```

Do not branch a dependent issue from an old worktree or an unmerged feature branch unless the dependency is intentionally being developed as a stacked branch.

## 11. Clean up the worktree

Only remove a worktree after its PR is merged and no further inspection is needed:

```bash
git worktree remove ../repo-issue-N
git worktree prune
```

The branch may be deleted according to repository policy after the PR is merged:

```bash
git push origin --delete issue-N-short-name
```

Do not use destructive Git commands such as `reset --hard`, `clean`, or forced branch deletion unless explicitly approved and understood.

## 12. Parallel implementation example

Independent issues can be implemented simultaneously in separate worktrees:

```bash
git worktree add ../repo-issue-1 -b issue-1-shell origin/main
git worktree add ../repo-issue-7 -b issue-7-audit origin/main
```

Run each implementation in its own terminal/session:

```text
# In ../repo-issue-1
/implement 1

# In ../repo-issue-7
/implement 7
```

Merge each PR independently. Once a blocker merges, recreate dependent worktrees from the updated base branch.

## Completion checklist

- [ ] Issue acceptance criteria are satisfied.
- [ ] Relevant tests and package checks pass.
- [ ] Smoke test or direct behavior verification completed where applicable.
- [ ] `/code-review` completed and findings resolved.
- [ ] Changes committed on the issue branch.
- [ ] Branch pushed to GitHub.
- [ ] PR links exactly one issue.
- [ ] CI passes and review is approved.
- [ ] PR merged into the integration branch.
- [ ] Issue closed.
- [ ] Worktree cleaned up after merge.
