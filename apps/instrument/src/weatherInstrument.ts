import { evaluateReplayFrame, loadReplayArchives } from './replayArchive.ts';
import type { InstrumentAudioPlan } from './audioParameters.ts';
import type { InstrumentVisualParameters } from './visualParameters.ts';
import type { ScoreOutput } from '@world-instrument/core';

export interface WeatherInstrumentState {
  readonly output: ScoreOutput;
  readonly visualParameters: InstrumentVisualParameters;
  readonly audioPlan: InstrumentAudioPlan;
  readonly sourceLabel: string;
}

export function loadFixtureWeatherInstrumentState(): Promise<WeatherInstrumentState> {
  const archive = loadReplayArchives()[0];

  if (archive === undefined) {
    throw new Error('Expected at least one recorded weather replay archive.');
  }

  return Promise.resolve(evaluateReplayFrame(archive, 0));
}
