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
7. Core stream, score, and replay contracts implemented: `JTW-15`.
8. Visual rendering path and browser instrument shell implemented: `JTW-16`.
9. First fixture-first weather adapter and deterministic weather score implemented: `JTW-17`.
10. Coverage thresholds and refactor review cadence implemented: `JTW-18`.
11. Weather score connected to the visual instrument scene: `JTW-33`.
12. Deterministic replay controls and archive playback implemented: `JTW-34`.
13. First deterministic Web Audio output layer implemented: `JTW-35`.
14. Haptic output abstraction and browser vibration prototype implemented: `JTW-36`.
15. Live weather stream mode connected to the instrument pipeline: `JTW-41`.
16. Replay capture and provenance export implemented: `JTW-42`.
17. Stream source registry and fixture-only non-weather source boundary implemented: `JTW-43`.

## Current Sequence

1. Monitor `JTW-44`, the active Cursor-delegated environment setup issue for installing Playwright Chromium in Cursor Cloud.
2. Do not release another coding-heavy Cursor issue until `JTW-44` lands, is explicitly paused, or is confirmed blocked.
3. Review the `JTW-44` PR when it appears, wait for automatic Codex review unless a documented exception applies, and merge only after checks and actionable feedback are handled.
4. After `JTW-44` lands, evaluate the current app against the World Instrument intent and create the next scoped product/code issues from concrete gaps.
5. Continue creating Linear issues for new problems, follow-on implementation work, refactor reviews, and human decisions as they arise.
6. If the explicit backlog runs out again, evaluate the built app against the product vision and create new scoped Linear issues for the next concrete gaps rather than pausing the project.
