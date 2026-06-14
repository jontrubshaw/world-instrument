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
- `score`: deterministic score input/output, bounded output parameters, and score version metadata.
- `replay`: replay snapshot types and runtime validation.
- `deterministic`: stable JSON serialization, hashing, seeded random, and bounded numeric helpers.

Other packages should depend on these exported contracts rather than reaching into internal files.

## Determinism Rules

- Scores must be pure functions of `ScoreInput` and declared `ScoreVersionMetadata`.
- Any pseudo-random behavior should use `createSeededRandom` with an explicit seed recorded in the score input or replay frame.
- Replay archives should validate with `parseReplaySnapshot` before being used for playback.
- Metadata fields must remain JSON-compatible so `stableStringify` and `hashJson` produce portable results.
