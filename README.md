# World Instrument

World Instrument is a real-time generative artwork that turns live data streams into visual, sonic, and haptic output.

The project treats public and private feeds as raw material rather than information to be displayed. Weather APIs, news feeds, sensors, market data, seismic activity, and other real-time streams can be connected to the system. Each stream is translated through a deterministic score: the same input data and score version should always produce the same output state.

The goal is not to visualize data literally. The goal is to make the world perceptible through a synthetic sensory language.

## Core Idea

World Instrument has four layers:

1. **Ingestion**  
   Collect real-time streams from APIs, sensors, files, sockets, or hardware.

2. **Normalization**  
   Convert each stream into stable, typed state: scalar values, rates of change, rolling averages, anomalies, categories, timestamps, and confidence.

3. **Deterministic Scores**  
   Map normalized stream state into output parameters with versioned formulas.

4. **Output Body**  
   Render the translated state as visuals, audio, haptics, light, motion, or physical actuation.

## Example Scores

Weather data might control diffusion, harmonic pressure, particle flow, and vibration density.

News data might control rhythmic density, consonance, spatial tension, and recurring motifs without displaying headlines directly.

Room sensors might control visual granularity, audio compression, and persistent memory in the installation.

## Design Principles

- Live, but not random.
- Deterministic, but not obvious.
- Abstract, but causally traceable.
- Replayable from archived input streams.
- Built around scores that can be published, versioned, and revised like musical compositions.

## Initial Build Direction

The first prototype should focus on:

- A small stream adapter interface.
- One weather stream adapter.
- One deterministic weather score.
- A browser-based visual output.
- Optional Web Audio output.
- A replay mode using recorded input snapshots.

## Repository Status

This repository now has the initial scaffold, quality gates, shared core contracts, and the first browser instrument app shell in place. The next feature work should build on the `packages/core` stream, score, replay, and deterministic utility boundary.

## Planned Stack

- TypeScript monorepo with npm workspaces.
- Vite + React for the browser instrument.
- Shared packages for stream contracts, deterministic scoring, replay fixtures, and output mappings.
- Three.js-backed WebGL visual output.
- Web Audio for browser-native sound output.
- Vitest, Playwright, ESLint, Prettier, and strict TypeScript for quality gates.

## Local Setup

Use Node 24 and npm 11 or newer. The repository includes `.nvmrc` and enforces the Node major through `package.json` engines and `.npmrc`.

```bash
npm ci
npm run setup:browsers
npm run check
npm run test:smoke
```

`npm run check` is the current required quality gate: TypeScript, ESLint, Prettier, and Vitest. `npm run test:smoke` runs the Playwright browser smoke test against the Vite-powered instrument app. On fresh Linux machines that also need browser system libraries, run `npm run setup:browsers:with-deps` instead of `npm run setup:browsers`.

Run the app locally with:

```bash
npm run dev -w @world-instrument/instrument
```

## Documentation

- [Project plan](docs/PROJECT_PLAN.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Tech stack](docs/TECH_STACK.md)
- [Quality bar](docs/QUALITY.md)
- [Orchestration](docs/ORCHESTRATION.md)
- [Agent handoff notes](AGENTS.md)

## Package Boundaries

- `packages/core`: shared stream state, adapter, score, replay, JSON metadata, and deterministic utility contracts.
- `packages/adapters`: source-specific ingestion and normalization implementations.
- `packages/scores`: deterministic score implementations built on `@world-instrument/core`.
- `apps/instrument`: browser runtime and user-facing instrument shell.

## Status

Cursor setup is complete. Runtime implementation work should still be selected intentionally through Linear before being assigned.
