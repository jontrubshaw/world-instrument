import {
  SCORE_INPUT_SCHEMA_VERSION,
  parseReplaySnapshot,
  type NormalizedStreamState,
  type Score,
  type ScoreOutput,
  type ScoreVersionMetadata,
} from '@world-instrument/core';
import {
  WEATHER_SCORE_V1_ID,
  browserSensorScoreV1,
  weatherScoreV1,
} from '@world-instrument/scores';

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
  readonly scoreId?: string;
  readonly scoreVersion?: string;
  readonly sourceLabel?: string;
  readonly statusLabel?: string;
}

export type InstrumentFrameInput = WeatherInstrumentFrameInput;

export const instrumentScores = [
  weatherScoreV1,
  browserSensorScoreV1,
] as const satisfies readonly Score[];
export const instrumentScoreMetadata = instrumentScores.map((score) => score.metadata);

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
  return evaluateInstrumentFrame(input);
}

export function evaluateInstrumentFrame(input: InstrumentFrameInput): WeatherInstrumentState {
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

export function evaluateWeatherScore(input: WeatherInstrumentFrameInput): ScoreOutput {
  return evaluateInstrumentScore({
    ...input,
    scoreId: input.scoreId ?? WEATHER_SCORE_V1_ID,
  });
}

export function evaluateInstrumentScore(input: InstrumentFrameInput): ScoreOutput {
  const score = scoreForInstrumentInput(input);

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

export function scoreMetadataForId(
  scoreId: string,
  scoreVersion?: string,
): ScoreVersionMetadata | undefined {
  return scoreForId(scoreId, scoreVersion)?.metadata;
}

export function scoreMetadataForOutput(output: ScoreOutput): ScoreVersionMetadata {
  return (
    scoreMetadataForId(output.scoreId, output.scoreVersion) ?? {
      schemaVersion: 'score-version.v1',
      scoreId: output.scoreId,
      scoreVersion: output.scoreVersion,
      displayName: `${output.scoreId} ${output.scoreVersion}`,
      deterministic: true,
      supportedStreamSchemas: ['stream-state.v1'],
    }
  );
}

function scoreForInstrumentInput(input: InstrumentFrameInput): Score {
  if (input.scoreId !== undefined) {
    const score = scoreForId(input.scoreId, input.scoreVersion);

    if (score !== undefined) {
      return score;
    }

    throw new Error(`Score '${input.scoreId}' is not registered with the instrument runtime.`);
  }

  if (
    input.streams.some(
      (stream) => stream.source.kind === 'sensor' || stream.streamId.startsWith('sensor:'),
    )
  ) {
    return browserSensorScoreV1;
  }

  return weatherScoreV1;
}

function scoreForId(scoreId: string, scoreVersion?: string): Score | undefined {
  return instrumentScores.find(
    (score) =>
      score.metadata.scoreId === scoreId &&
      (scoreVersion === undefined || score.metadata.scoreVersion === scoreVersion),
  );
}

function sourceLabel(streams: readonly NormalizedStreamState[]): string {
  const stream = streams[0];

  return stream?.source.label ?? stream?.source.id ?? 'Instrument stream';
}
