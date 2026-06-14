# Orchestration

## Roles

- Codex: orchestration, planning, documentation, lightweight scaffolding, issue creation, review coordination, merge coordination, and hygiene checks.
- Cursor: coding-heavy implementation work.
- Jonny Trubshaw: human decisions, environment setup, credentials, design direction, and approvals that require owner judgment.

## Linear

- Track all meaningful work in Linear under the `World Instrument` project.
- Create planned coding work as backlog first.
- Assign or delegate coding-heavy work to `Cursor` only when the issue is ready to start.
- Assign human-attention work to `Jonny Trubshaw`.
- Create new issues as problems arise.
- Keep issue descriptions actionable with acceptance criteria.

## Cursor Handoffs

- When Cursor owns a coding issue, operational handoffs to Cursor happen in that Linear issue thread, not in GitHub PR comments.
- Cursor may open implementation PRs as drafts. Once Cursor has completed its initial work and is no longer actively pushing, Codex should mark the PR ready for review before waiting for automatic Codex review.
- Before marking a Cursor draft PR ready, confirm there is a handoff signal in Linear or another clear sign of completion, such as a completed Cursor comment, stable branch activity, or user confirmation.
- After Codex review completes on a Cursor-owned PR, summarize actionable findings in a Linear comment that mentions `@Cursor`.
- The handoff comment should include the PR number, branch name, each actionable review finding, the instruction to address findings on the same branch, and the expected verification command.
- Keep GitHub comments for reviewer-facing discussion only. Use Linear as the agent coordination channel so Cursor receives the work in the place it is watching.
- After Cursor pushes follow-up commits, re-check CI and wait for the subsequent automatic Codex review before merging, unless a documented fallback rule applies.

## GitHub

- Use branches tied to Linear issue identifiers.
- Open PRs for implementation changes.
- Wait for automatic Codex PR reviews after PR creation and subsequent pushes.
- For docs-only or similarly low-risk orchestration updates, use best judgment: if the PR is clean, has no actionable feedback, and Codex has provided a thumbs-up signal or the change is clearly non-runtime, it can merge without waiting the full review window.
- After pushing to a PR, wait about 10 minutes by default before re-checking review state.
- If no review appears for the latest PR head after 10 minutes, check timestamps and wait another 5 minutes.
- If no latest-head review appears after 15 minutes total, merge when the PR is clean and all known actionable feedback has been addressed.
- Merge to `main` only after reviews complete, or after the 15-minute fallback threshold when the PR is clean and all known actionable feedback has been addressed.
- Jonny has approved Codex to merge reviewed PRs.
- Avoid putting implementation issue identifiers in docs-only PR titles, branch names, or PR bodies unless necessary. If a docs-only PR references an implementation issue, verify the Linear issue state after merge because integrations may attach or complete the wrong issue.

## Current Work Selection

Cursor environment setup is complete. Coding-heavy issues should still be assigned or delegated to Cursor only when intentionally ready to start. Keep planned work in Backlog until it is selected.

`JTW-15` is the current coding-heavy work delegated to Cursor. Do not release another coding-heavy Cursor issue until `JTW-15` opens a fresh PR/branch, lands, or is confirmed stalled. While waiting, Codex should continue with non-blocking orchestration work: planning docs, issue grooming, review coordination, and cleanup that does not conflict with `packages/core`.

## CI

The baseline CI workflow runs on pull requests and pushes to `main`. It installs dependencies with `npm ci` under Node 24 and runs `npm run check`. Add browser/e2e jobs only after the instrument app shell and Playwright configuration exist.
