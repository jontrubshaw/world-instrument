import {
  SCORE_INPUT_SCHEMA_VERSION,
  parseReplaySnapshot,
  type NormalizedStreamState,
  type Score,
  type ScoreOutput,
  type ScoreVersionMetadata,
} from '@world-instrument/core';
import { browserSensorScoreV1, weatherScoreV1 } from '@world-instrument/scores';

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
  readonly score?: ScoreVersionMetadata;
  readonly scoreId?: string;
  readonly sourceLabel?: string;
  readonly statusLabel?: string;
}

const instrumentScores = [weatherScoreV1, browserSensorScoreV1] as const satisfies readonly Score[];

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
  return evaluateInstrumentFrame({
    ...input,
    scoreId: weatherScoreV1.metadata.scoreId,
  });
}

export function evaluateInstrumentFrame(
  input: WeatherInstrumentFrameInput,
): WeatherInstrumentState {
  const output = evaluateInstrumentScore(input);

  return {
    frameIndex: input.frameIndex,
    elapsedMs: input.elapsedMs,
    sourceLabel: input.sourceLabel ?? sourceLabel(input.streams),
    statusLabel:
      input.statusLabel ?? `${mapScoreOutputToVisualParameters(output).condition} weather frame`,
    output,
    visualParameters: mapScoreOutputToVisualParameters(output),
    audioParameters: mapScoreOutputToAudioParameters(output),
    hapticPattern: mapScoreOutputToHapticPattern(output),
  };
}

export function evaluateInstrumentScore(input: WeatherInstrumentFrameInput): ScoreOutput {
  const score = resolveInstrumentScore({
    streams: input.streams,
    ...(input.score === undefined ? {} : { score: input.score }),
    ...(input.scoreId === undefined ? {} : { scoreId: input.scoreId }),
  });

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

export function evaluateWeatherScore(input: WeatherInstrumentFrameInput): ScoreOutput {
  return weatherScoreV1.evaluate({
    schemaVersion: SCORE_INPUT_SCHEMA_VERSION,
    score: weatherScoreV1.metadata,
    frame: {
      frameIndex: input.frameIndex,
      elapsedMs: input.elapsedMs,
      renderedAt: input.capturedAt,
    },
    streams: input.streams,
    seed: input.seed,
  });
}

export function instrumentScoreMetadatas(): readonly ScoreVersionMetadata[] {
  return instrumentScores.map((score) => score.metadata);
}

export function instrumentScoreMetadataForOutput(output: ScoreOutput): ScoreVersionMetadata {
  const score = resolveInstrumentScore({ scoreId: output.scoreId });

  if (score.metadata.scoreVersion !== output.scoreVersion) {
    throw new Error(
      `Score '${output.scoreId}' output version '${output.scoreVersion}' does not match registered version '${score.metadata.scoreVersion}'.`,
    );
  }

  return score.metadata;
}

export function resolveInstrumentScore(
  options: {
    readonly score?: ScoreVersionMetadata;
    readonly scoreId?: string;
    readonly streams?: readonly NormalizedStreamState[];
  } = {},
): Score {
  if (options.score !== undefined) {
    const requestedScore = options.score;
    const scoreForMetadata = instrumentScores.find((score) =>
      scoreMetadataMatches(score.metadata, requestedScore),
    );

    if (scoreForMetadata === undefined) {
      throw new Error(
        `Score '${options.score.scoreId}' version '${options.score.scoreVersion}' is not registered in the instrument app.`,
      );
    }

    return scoreForMetadata;
  }

  if (options.scoreId !== undefined) {
    const scoreForId = instrumentScores.find((score) => score.metadata.scoreId === options.scoreId);

    if (scoreForId === undefined) {
      throw new Error(`Score '${options.scoreId}' is not registered in the instrument app.`);
    }

    return scoreForId;
  }

  return options.streams?.some((stream) => stream.source.kind === 'sensor')
    ? browserSensorScoreV1
    : weatherScoreV1;
}

function sourceLabel(streams: readonly NormalizedStreamState[]): string {
  const stream = streams[0];

  return stream?.source.label ?? stream?.source.id ?? 'Weather stream';
}

function scoreMetadataMatches(
  knownScore: ScoreVersionMetadata,
  requestedScore: ScoreVersionMetadata,
): boolean {
  return (
    knownScore.scoreId === requestedScore.scoreId &&
    knownScore.scoreVersion === requestedScore.scoreVersion
  );
}
