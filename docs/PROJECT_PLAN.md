# Project Plan

World Instrument is a real-time generative artwork that ingests live streams and deterministically translates them into visual, sonic, and haptic artifacts.

The project should be built as a high-quality creative system, not an MVP. Determinism, replayability, testability, and maintainability are core product requirements.

## Workstreams

1. Project foundation
   - Repository scaffold.
   - Documentation.
   - PR workflow.
   - CI, lint, typecheck, test gates.

2. Core model
   - Stream adapter interface.
   - Normalized stream state model.
   - Score contract and versioning.
   - Deterministic utilities.
   - Replay capture and playback format.

3. First stream: weather
   - Provider selection.
   - Adapter implementation.
   - Normalization.
   - Weather score v1.
   - Recorded fixtures.

4. Visual instrument
   - Browser app shell.
   - Rendering engine selection.
   - Deterministic visual scene.
   - Performance budget.
   - Visual smoke tests.

5. Sound instrument
   - Web Audio synthesis graph.
   - Deterministic audio mapping.
   - User-controlled activation.
   - Replay-consistent audio state.

6. Haptics and physical output
   - Browser vibration where available.
   - Hardware abstraction for future devices.
   - Safety limits.

7. Replay and archive
   - Snapshot schema.
   - Replay runner.
   - Golden-output tests.
   - Score version pinning.

8. Product quality
   - Accessibility basics.
   - Clear failure states.
   - Test coverage thresholds.
   - Refactor reviews.
   - Dependency audits.

## Completed Setup

1. Comprehensive Linear plan issue created: `JTW-11`.
2. Repository structure and documentation scaffolded: `JTW-12`.
3. Cursor environment setup completed: `JTW-13`.
4. CI baseline established and merged: `JTW-14`.
5. PR review fallback policy documented: `JTW-20`.
6. Stale pre-setup Cursor PRs closed and documented: `JTW-21`.

## Current Sequence

1. Monitor `JTW-15`, which is the active coding-heavy issue delegated to Cursor.
2. Do not release another coding-heavy Cursor issue until `JTW-15` opens a fresh PR/branch, lands, or is confirmed stalled.
3. Review the `JTW-15` PR when it appears, wait for automatic Codex review unless a documented exception applies, and merge only after checks and actionable feedback are handled.
4. After `JTW-15` lands, update docs and release `JTW-16` for the visual rendering decision and app shell.
5. Keep `JTW-19` with Jonny for the weather provider and credential decision; fixture-first weather work can be planned before live credentials, but live provider integration should not proceed without that decision.
6. Continue creating Linear issues for new problems, follow-on implementation work, refactor reviews, and human decisions as they arise.
