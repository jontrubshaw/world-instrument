import {
  SCORE_INPUT_SCHEMA_VERSION,
  parseReplaySnapshot,
  type NormalizedStreamState,
  type Score,
  type ScoreOutput,
  type ScoreVersionMetadata,
} from '@world-instrument/core';
import { sensorScoreV1, weatherScoreV1 } from '@world-instrument/scores';

import type { InstrumentAudioParameters } from './audioParameters.ts';
import { mapScoreOutputToAudioParameters } from './audioParameters.ts';
import type { InstrumentHapticPattern } from './hapticParameters.ts';
import { mapScoreOutputToHapticPattern } from './hapticParameters.ts';
import type { InstrumentVisualParameters } from './visualParameters.ts';
import { mapScoreOutputToVisualParameters } from './visualParameters.ts';
import recordedWeatherReplay from './replayArchives/weather-london.v1.replay.json';

export interface WeatherInstrumentState {
  readonly frameIndex: number;
  readonly elapsedMs: number;
  readonly visualParameters: InstrumentVisualParameters;
  readonly audioParameters: InstrumentAudioParameters;
  readonly hapticPattern: InstrumentHapticPattern;
  readonly sourceLabel: string;
  readonly statusLabel: string;
  readonly output: ScoreOutput;
}

export interface WeatherInstrumentFrameInput {
  readonly frameIndex: number;
  readonly elapsedMs: number;
  readonly capturedAt: string;
  readonly streams: readonly NormalizedStreamState[];
  readonly seed: string;
  readonly score?: Score;
  readonly sourceLabel?: string;
  readonly statusLabel?: string;
}

export function loadFixtureWeatherInstrumentState(): Promise<WeatherInstrumentState> {
  const snapshot = parseReplaySnapshot(recordedWeatherReplay);
  const frame = snapshot.frames[0];

  if (frame === undefined) {
    throw new Error('Expected at least one recorded weather replay frame.');
  }

  return Promise.resolve(
    evaluateWeatherInstrumentFrame({
      frameIndex: frame.frameIndex,
      elapsedMs: frame.elapsedMs,
      capturedAt: frame.capturedAt,
      streams: frame.streams,
      seed: frame.seed,
      sourceLabel: sourceLabel(frame.streams),
    }),
  );
}

export function evaluateWeatherInstrumentFrame(
  input: WeatherInstrumentFrameInput,
): WeatherInstrumentState {
  const output = evaluateInstrumentScore(input);

  return {
    frameIndex: input.frameIndex,
    elapsedMs: input.elapsedMs,
    sourceLabel: input.sourceLabel ?? sourceLabel(input.streams),
    statusLabel:
      input.statusLabel ??
      `${mapScoreOutputToVisualParameters(output).condition} ${sourceKind(input.streams)} frame`,
    output,
    visualParameters: mapScoreOutputToVisualParameters(output),
    audioParameters: mapScoreOutputToAudioParameters(output),
    hapticPattern: mapScoreOutputToHapticPattern(output),
  };
}

export function evaluateWeatherScore(input: WeatherInstrumentFrameInput): ScoreOutput {
  return evaluateInstrumentScore({
    ...input,
    score: weatherScoreV1,
  });
}

export function evaluateInstrumentScore(input: WeatherInstrumentFrameInput): ScoreOutput {
  const score = input.score ?? scoreForStreams(input.streams);

  return score.evaluate({
    schemaVersion: SCORE_INPUT_SCHEMA_VERSION,
    score: score.metadata,
    frame: {
      frameIndex: input.frameIndex,
      elapsedMs: input.elapsedMs,
      renderedAt: input.capturedAt,
    },
    streams: input.streams,
    seed: input.seed,
  });
}

export function scoreForStreams(streams: readonly NormalizedStreamState[]): Score {
  return streams.some(
    (stream) => stream.source.kind === 'sensor' || stream.streamId.startsWith('sensor:'),
  )
    ? sensorScoreV1
    : weatherScoreV1;
}

export function scoreForMetadata(metadata: ScoreVersionMetadata): Score {
  if (
    metadata.scoreId === sensorScoreV1.metadata.scoreId &&
    metadata.scoreVersion === sensorScoreV1.metadata.scoreVersion
  ) {
    return sensorScoreV1;
  }

  return weatherScoreV1;
}

export function scoreMetadataForOutput(output: ScoreOutput | undefined): ScoreVersionMetadata {
  if (
    output?.scoreId === sensorScoreV1.metadata.scoreId &&
    output.scoreVersion === sensorScoreV1.metadata.scoreVersion
  ) {
    return sensorScoreV1.metadata;
  }

  return weatherScoreV1.metadata;
}

function sourceLabel(streams: readonly NormalizedStreamState[]): string {
  const stream = streams[0];

  return stream?.source.label ?? stream?.source.id ?? 'Instrument stream';
}

function sourceKind(streams: readonly NormalizedStreamState[]): string {
  return streams[0]?.source.kind ?? 'stream';
}
