# Architecture

World Instrument is organized as a deterministic translation pipeline.

## Pipeline

1. Ingestion
   - Pull or receive data from APIs, sensors, sockets, files, and replay archives.

2. Normalization
   - Convert source-specific payloads into typed stream state with timestamps, units, rates of change, rolling windows, categories, and confidence.

3. Scores
   - Convert normalized stream state into output parameters through versioned deterministic formulas.

4. Output body
   - Render the resulting state as visuals, sound, haptics, lighting, motion, or future physical actuation.

## Determinism Requirements

- Scores must be pure with respect to their explicit input state and score version.
- Any seeded pseudo-random behavior must derive from input state and declared score metadata.
- Time-sensitive data must be represented as explicit timestamps in replayable snapshots.
- Archived input streams must be able to reproduce the same score output under the same score version.

## Package Boundaries

- `apps/instrument`: Browser runtime and user-facing instrument.
- `packages/core`: Shared contracts and deterministic primitives.
- `packages/adapters`: Stream-specific adapters and normalization.
- `packages/scores`: Versioned score implementations.

## Output Modalities

- Visual: WebGL-first browser rendering.
- Sound: deterministic score-to-audio parameter plans drive a small Web Audio graph. The browser `AudioContext` is not constructed or resumed until the user activates the Start Audio control, preserving autoplay compliance while replay frames continue to advance silently.
- Haptics: Browser vibration where supported and future hardware adapters.

## Non-Goals

- Do not build a conventional dashboard.
- Do not expose raw news/weather/feed data as the primary artwork.
- Do not add opaque randomness that breaks replayability.
