# Quality Bar

World Instrument should be built as a durable creative system.

## Required Gates

- Node 24 LTS baseline.
- TypeScript strict mode.
- ESLint must pass.
- Prettier check must pass.
- Unit and contract tests must pass.
- Browser smoke tests must cover the instrument shell once implemented.

## Test Expectations

- Score functions need deterministic golden tests.
- Stream adapters need fixture-based tests.
- Replay must test identical input producing identical score output.
- Visual implementation needs at least one smoke test that verifies a nonblank rendered frame.
- Audio and haptics need contract tests for bounded output parameters.

## Review Expectations

- Every implementation PR should reference a Linear issue.
- Automatic Codex PR review must complete before merge.
- PRs should include test evidence or explain why tests were not applicable.
- Refactor review issues should be created periodically after major feature work.

## Documentation Expectations

- Update docs when architecture, score contracts, or orchestration rules change.
- Keep `AGENTS.md` current enough to recover project state after context loss.
- Keep README focused on orientation, not exhaustive implementation detail.
