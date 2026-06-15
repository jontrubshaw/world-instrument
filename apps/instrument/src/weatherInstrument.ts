import { SCORE_INPUT_SCHEMA_VERSION } from '@world-instrument/core';
import { WeatherAdapter, recordedOpenMeteoLondonCurrentV1 } from '@world-instrument/adapters';
import { weatherScoreV1 } from '@world-instrument/scores';

import {
  mapScoreOutputToVisualParameters,
  type InstrumentVisualParameters,
} from './visualParameters.ts';

const WEATHER_FIXTURE_SEED = 'weather-score-v1:london:0';

export interface WeatherInstrumentState {
  readonly visualParameters: InstrumentVisualParameters;
  readonly sourceLabel: string;
}

export async function loadFixtureWeatherInstrumentState(): Promise<WeatherInstrumentState> {
  const adapter = new WeatherAdapter({
    mode: 'fixture',
    fixture: recordedOpenMeteoLondonCurrentV1,
    sequence: 0,
  });
  const result = await adapter.read();
  const output = weatherScoreV1.evaluate({
    schemaVersion: SCORE_INPUT_SCHEMA_VERSION,
    score: weatherScoreV1.metadata,
    frame: {
      frameIndex: 0,
      elapsedMs: 0,
      renderedAt: result.state.observedAt,
    },
    streams: [result.state],
    seed: WEATHER_FIXTURE_SEED,
  });

  return {
    visualParameters: mapScoreOutputToVisualParameters(output),
    sourceLabel: result.state.source.label ?? result.state.source.id,
  };
}
