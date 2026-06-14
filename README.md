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

## Packages

- [`@world-instrument/core`](packages/core/README.md) defines the shared TypeScript contracts for
  normalized stream state, stream adapters, deterministic scores, replay snapshots, and score
  utility primitives. Other packages should consume it through the package root export.

## Status

This repository is the starting point for the project.
