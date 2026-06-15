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

## Stream Source Registry

New realtime inputs enter through a stream source registry before they receive bespoke runtime UI.
Core defines `StreamSourceDefinition` and compatibility helpers; adapters publish concrete registry
entries and adapter factories. A registry entry documents:

- source and adapter identity;
- whether the source supports fixture, live, and/or replay modes;
- normalized `stream-state` schema, source kind, stream id prefix, sample keys, and metadata keys;
- compatible deterministic score ids and stream schemas.

Weather is the first live-capable source. A fixture-only mock sensor source proves the same boundary
for non-weather inputs without adding a production sensor integration or score yet.

## Output Modalities

- Visual: WebGL-first browser rendering.
- Sound: Web Audio API, started only after user activation.
- Haptics: Browser vibration where supported and future hardware adapters.

## Non-Goals

- Do not build a conventional dashboard.
- Do not expose raw news/weather/feed data as the primary artwork.
- Do not add opaque randomness that breaks replayability.
