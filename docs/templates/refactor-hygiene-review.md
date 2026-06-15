# Refactor / Codebase Hygiene Review

## Summary

Review the current codebase for maintainability risks after recent feature or tooling work.

## Trigger

- Recent feature slice, dependency update, or repeated review feedback prompting this review:

## Scope

- Packages/apps to inspect:
- Contracts, adapters, scores, or UI seams to revisit:
- Known areas of concern:

## Review Checklist

- [ ] Run the current quality gate (`npm run check`) and note the result.
- [ ] Review public package contracts for unnecessary churn, leaky abstractions, or missing invariants.
- [ ] Review tests for brittle fixtures, missing edge cases, and coverage gaps hidden by aggregate thresholds.
- [ ] Review adapter/score boundaries for duplicated parsing, normalization, or deterministic helper logic.
- [ ] Review app shell boundaries for UI, rendering, audio, and future haptic responsibilities that should be separated.
- [ ] Review documentation and `AGENTS.md` for stale decisions or orchestration notes.
- [ ] Create follow-up issues for concrete fixes rather than bundling broad refactors into the review issue.

## Acceptance Criteria

- Findings are summarized with file/module references and severity.
- Follow-up issues are created for actionable refactors or missing tests.
- Any no-op areas are explicitly called out so future reviewers know they were checked.
- The issue is closed only after either follow-ups exist or the review records that no action is needed.
