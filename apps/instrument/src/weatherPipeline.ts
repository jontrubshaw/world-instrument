import {
  SCORE_INPUT_SCHEMA_VERSION,
  type NormalizedStreamState,
  type ScoreOutput,
} from '@world-instrument/core';
import { weatherScoreV1 } from '@world-instrument/scores';

import {
  mapScoreOutputToAudioParameters,
  type InstrumentAudioParameters,
} from './audioParameters.ts';
import { mapScoreOutputToHapticPattern, type InstrumentHapticPattern } from './hapticParameters.ts';
import {
  mapScoreOutputToVisualParameters,
  type InstrumentVisualParameters,
} from './visualParameters.ts';

export interface WeatherInstrumentFrameInput {
  readonly frameIndex: number;
  readonly elapsedMs: number;
  readonly renderedAt: string;
  readonly streams: readonly NormalizedStreamState[];
  readonly seed: string;
}

export interface WeatherInstrumentPipelineState {
  readonly sourceLabel: string;
  readonly output: ScoreOutput;
  readonly visualParameters: InstrumentVisualParameters;
  readonly audioParameters: InstrumentAudioParameters;
  readonly hapticPattern: InstrumentHapticPattern;
}

export function evaluateWeatherInstrumentPipeline(
  input: WeatherInstrumentFrameInput,
): WeatherInstrumentPipelineState {
  const output = evaluateWeatherScore(input);

  return {
    sourceLabel: sourceLabel(input.streams),
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
      renderedAt: input.renderedAt,
    },
    streams: input.streams,
    seed: input.seed,
  });
}

function sourceLabel(streams: readonly NormalizedStreamState[]): string {
  const stream = streams[0];

  return stream?.source.label ?? stream?.source.id ?? 'Weather stream';
}
