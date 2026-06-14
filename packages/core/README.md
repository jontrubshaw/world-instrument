# @world-instrument/core

Shared contracts for deterministic World Instrument streams, scores, and replay snapshots.

## Public boundary

Consumers should import from the package root only:

```ts
import type { Score, StreamAdapter } from "@world-instrument/core";
import { createDeterministicRandom, parseReplaySnapshot } from "@world-instrument/core";
```

Files under `src/` are implementation modules and are not separate public entrypoints. Add new
exports through `src/index.ts` when a type or function is intended for other packages.

## Contracts

- **Stream state**: `NormalizedStreamState` represents replayable, normalized stream data with
  typed channels for scalar values, rates, categories, flags, and events.
- **Stream adapters**: `StreamAdapter` normalizes raw stream envelopes into
  `NormalizedStreamState` and can optionally expose configuration and async reads.
- **Scores**: `Score` evaluates a `ScoreInput` into a `ScoreOutput`. Score inputs and outputs both
  carry `ScoreVersionMetadata`, including a deterministic hash for version tracking.
- **Replay snapshots**: `ReplaySnapshot` captures a frame, normalized stream states, and optional
  score outputs. Use `parseReplaySnapshot` or `isReplaySnapshot` for runtime validation.
- **Deterministic utilities**: stable JSON serialization, FNV-1a hashing, seeded random streams,
  and numeric helpers are exported for score implementations.

Schema-version string literals are compatibility boundaries. Introduce a new version before making
breaking changes to persisted replay data.
