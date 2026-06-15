# Core Package

Shared contracts and deterministic primitives for World Instrument.

## Responsibility

- Normalized stream state model.
- Stream adapter contracts.
- Score contracts and score version metadata.
- Deterministic math and hashing utilities.
- Replay snapshot and playback primitives.
- Shared output parameter schemas.

## Public Boundary

Import from the package root:

```ts
import {
  STREAM_STATE_SCHEMA_VERSION,
  type NormalizedStreamState,
  type Score,
  parseReplaySnapshot,
} from '@world-instrument/core';
```

The package root re-exports the stable contract modules:

- `json`: JSON-compatible metadata primitives.
- `stream`: normalized stream state, stream samples, stream sources, and adapter contracts.
- `stream-source-registry`: source catalog entries, capabilities, normalized mapping docs, and score compatibility helpers.
- `score`: deterministic score input/output, bounded output parameters, and score version metadata.
- `replay`: replay snapshot types and runtime validation.
- `deterministic`: stable JSON serialization, hashing, seeded random, and bounded numeric helpers.

Other packages should depend on these exported contracts rather than reaching into internal files.

## Determinism Rules

- Scores must be pure functions of `ScoreInput` and declared `ScoreVersionMetadata`.
- Any pseudo-random behavior should use `createSeededRandom` with an explicit seed recorded in the score input or replay frame.
- Replay archives should validate with `parseReplaySnapshot` before being used for playback.
- Metadata fields must remain JSON-compatible so `stableStringify` and `hashJson` produce portable results.

## Stream Source Registry Boundary

`StreamSourceDefinition` records the product and technical contract for a source before app UI
depends on it:

- adapter identity and version;
- supported modes (`fixture`, `live`, `replay`) and credential requirements;
- normalized stream kind, stream id prefix, schema version, sample keys, and metadata keys;
- compatible deterministic score ids and supported stream schemas.

Core owns the registry types and compatibility helpers only. Adapter packages own concrete source
definitions and factories so new realtime inputs can be cataloged without adding score or app
dependencies to `@world-instrument/core`.
