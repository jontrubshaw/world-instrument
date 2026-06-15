import {
  SCORE_INPUT_SCHEMA_VERSION,
  type NormalizedStreamState,
  type ScoreOutput,
} from '@world-instrument/core';
import { weatherScoreV1 } from '@world-instrument/scores';

import type { InstrumentAudioParameters } from './audioParameters.ts';
import { mapScoreOutputToAudioParameters } from './audioParameters.ts';
import type { InstrumentHapticPattern } from './hapticParameters.ts';
import { mapScoreOutputToHapticPattern } from './hapticParameters.ts';
import type { InstrumentVisualParameters } from './visualParameters.ts';
import { mapScoreOutputToVisualParameters } from './visualParameters.ts';

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
  readonly sourceLabel?: string;
  readonly statusLabel?: string;
}

export function loadFixtureWeatherInstrumentState(): Promise<WeatherInstrumentState> {
  return import('./replayArchive.ts').then(({ evaluateReplayFrame, loadReplayArchives }) => {
    const archive = loadReplayArchives()[0];

    if (archive === undefined) {
      throw new Error('Expected at least one recorded weather replay archive.');
    }

    return evaluateReplayFrame(archive, 0);
  });
}

export function evaluateWeatherInstrumentFrame(
  input: WeatherInstrumentFrameInput,
): WeatherInstrumentState {
  const output = evaluateWeatherScore(input);

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

function sourceLabel(streams: readonly NormalizedStreamState[]): string {
  const stream = streams[0];

  return stream?.source.label ?? stream?.source.id ?? 'Weather stream';
}
