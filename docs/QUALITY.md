# Quality Bar

World Instrument should be built as a durable creative system.

## Required Gates

- Node 24 LTS baseline.
- `npm ci` must succeed from a fresh checkout.
- TypeScript strict mode.
- ESLint must pass.
- Prettier check must pass.
- Unit and contract tests must pass.
- Browser smoke tests must cover the instrument shell once implemented.

The current CI gate runs `npm ci` and `npm run check`. Browser smoke tests are intentionally excluded until the app shell and Playwright configuration exist.

## Test Expectations

- Score functions need deterministic golden tests.
- Stream adapters need fixture-based tests.
- Replay must test identical input producing identical score output.
- Visual implementation needs at least one smoke test that verifies a nonblank rendered frame.
- Audio and haptics need contract tests for bounded output parameters.

## Review Expectations

- Every implementation PR should reference a Linear issue.
- Automatic Codex PR review should complete before merge, except under the documented low-risk docs and 15-minute fallback rules in `docs/ORCHESTRATION.md`.
- Cursor-owned PR review findings should be handed back to Cursor through the Linear issue thread, not through a PR comment.
- Cursor handoff comments should mention `@Cursor`, identify the PR and branch, enumerate actionable findings, request same-branch fixes, and require `npm run check` before handback.
- PRs should include test evidence or explain why tests were not applicable.
- Refactor review issues should be created periodically after major feature work.

## Documentation Expectations

- Update docs when architecture, score contracts, or orchestration rules change.
- Keep `AGENTS.md` current enough to recover project state after context loss.
- Keep README focused on orientation, not exhaustive implementation detail.
