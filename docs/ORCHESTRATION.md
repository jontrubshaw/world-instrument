# Orchestration

## Roles

- Codex: orchestration, planning, documentation, lightweight scaffolding, issue creation, review coordination, merge coordination, and hygiene checks.
- Cursor: coding-heavy implementation work.
- Jonny Trubshaw: human decisions, environment setup, credentials, design direction, and approvals that require owner judgment.

## Linear

- Track all meaningful work in Linear under the `World Instrument` project.
- Create planned coding work as backlog first.
- Assign or delegate coding-heavy work to `Cursor` only when the issue is ready to start.
- Before assigning/delegating, reassigning, or re-pinging Cursor on a coding-heavy issue, run a duplicate-session pre-flight check:
  - Fetch the Linear issue and recent comments.
  - Check issue attachments and GitHub for open PRs/branches tied to that issue.
  - Check for existing Cursor session links, Cursor handback comments, or stopped/unavailable session messages.
  - If an active Cursor session already exists for the issue, continue that session rather than launching a second one.
  - If the existing Cursor session is stopped, unavailable, or ambiguous, create or update a human-attention blocker and wait for restart/reassignment unless Jonny explicitly approves superseding it.
  - If intentionally superseding a stuck session, document the decision in Linear and close or mark stale PRs as superseded before starting another Cursor session.
- Assign human-attention work to `Jonny Trubshaw`.
- Create new issues as problems arise.
- Keep issue descriptions actionable with acceptance criteria.

## Backlog Discovery

- If there is no active implementation PR and no ready backlog issue remains, Codex should evaluate the current repository and product state against the World Instrument intent.
- Look for concrete gaps in deterministic streams, replayability, visual output, sound output, haptics, quality gates, app experience, and documentation.
- Create new Linear issues for the highest-value gaps, with scoped descriptions and acceptance criteria.
- Assign human-decision issues to Jonny. Keep coding-heavy issues in Backlog until intentionally selected, and delegate them to Cursor only when ready to start.
- Continue orchestration from the newly created issues rather than stopping because the original backlog is empty.

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

`JTW-52` is the current coding-heavy work delegated to Cursor. Do not release another coding-heavy Cursor issue until `JTW-52` lands, is explicitly paused, or is confirmed blocked with a documented decision. Before any restart, reassign, or new Cursor ping on `JTW-52`, run the duplicate-session pre-flight check above.

## CI

The baseline CI workflow runs on pull requests and pushes to `main`. It installs dependencies with `npm ci` under Node 24 and runs `npm run check`. Add browser/e2e jobs only after the instrument app shell and Playwright configuration exist.
