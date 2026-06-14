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

## GitHub

- Use branches tied to Linear issue identifiers.
- Open PRs for implementation changes.
- Wait for automatic Codex PR reviews after PR creation and subsequent pushes.
- After pushing to a PR, wait about 10 minutes by default before re-checking review state.
- If no review appears for the latest PR head after 10 minutes, check timestamps and wait another 5 minutes before manually triggering review or asking for direction.
- Merge to `main` only after reviews complete and blockers are resolved.
- Jonny has approved Codex to merge reviewed PRs.

## Current Pause

After scaffolding, create a Linear issue for Jonny to set up Cursor for this repository and pause before runtime implementation starts.
