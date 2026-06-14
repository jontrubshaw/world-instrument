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

## Current Sequence

1. Create the comprehensive Linear plan issue: `JTW-11`.
2. Scaffold repository structure and documentation: `JTW-12`.
3. Create a Cursor setup issue for Jonny.
4. Pause until Cursor is ready.
5. Move ready coding-heavy implementation issues out of backlog and delegate them to Cursor.
6. Review PRs, wait for automatic Codex reviews, then merge approved work to `main`.
