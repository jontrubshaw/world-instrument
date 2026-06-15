# Quality Bar

World Instrument should be built as a durable creative system.

## Required Gates

- Node 24 LTS baseline.
- `npm ci` must succeed from a fresh checkout.
- TypeScript strict mode.
- ESLint must pass.
- Prettier check must pass.
- Unit and contract tests must pass with package coverage thresholds enforced.
- Browser smoke tests must cover the instrument shell.

The current CI gate runs `npm ci`, `npm run check`, `npm run build`, installs the Playwright Chromium browser through `npm run setup:browsers:with-deps`, and runs `npm run test:smoke`.
`npm run check` includes typecheck, lint, format check, and `npm run test:coverage`.

## Coverage Policy

Vitest coverage is enforced for executable source under `packages/*/src`.
The initial threshold is:

| Metric     | Minimum |
| ---------- | ------: |
| Statements |     80% |
| Branches   |     70% |
| Functions  |     90% |
| Lines      |     80% |

These targets are intentionally package-focused because the current source packages contain the deterministic core contracts, weather adapter, and weather score logic where regressions would affect replay correctness.
The browser app shell is still covered by Playwright smoke tests until UI behavior has enough unit-testable seams to justify app coverage thresholds.
`packages/core/src/json.ts` is excluded because it exports type-only JSON declarations and has no runtime statements to exercise.

The branch target starts lower than line and statement coverage because early adapter and score code has provider error paths, weather-code classifications, and palette branches that need representative fixtures over time.
Raise thresholds when new fixtures or contract tests make a higher gate sustainable without encouraging artificial tests.

## Test Expectations

- Score functions need deterministic golden tests.
- Stream adapters need fixture-based tests.
- Replay must test identical input producing identical score output.
- Visual implementation needs at least one smoke test that verifies the browser shell and rendered surface load.
- Audio and haptics need contract tests for bounded output parameters.

## Review Expectations

- Every implementation PR should reference a Linear issue.
- Cursor-owned draft PRs should be marked ready for review once Cursor has clearly handed back the initial work and is no longer actively pushing.
- Automatic Codex PR review should complete before merge, except under the documented low-risk docs and 15-minute fallback rules in `docs/ORCHESTRATION.md`.
- Cursor-owned PR review findings should be handed back to Cursor through the Linear issue thread, not through a PR comment.
- Cursor handoff comments should mention `@Cursor`, identify the PR and branch, enumerate actionable findings, request same-branch fixes, and require `npm run check` before handback.
- PRs should include test evidence or explain why tests were not applicable.
- Refactor review issues should be created after substantial feature slices land, after large dependency/tooling updates, or whenever repeated review comments point to a cross-cutting design smell.
- Use `docs/templates/refactor-hygiene-review.md` when creating periodic codebase hygiene review issues.

## Documentation Expectations

- Update docs when architecture, score contracts, or orchestration rules change.
- Keep `AGENTS.md` current enough to recover project state after context loss.
- Keep README focused on orientation, not exhaustive implementation detail.
