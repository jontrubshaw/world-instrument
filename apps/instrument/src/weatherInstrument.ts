import { evaluateReplayFrame, loadReplayArchives } from './replayArchive.ts';
import type { InstrumentAudioParameters } from './audioParameters.ts';
import type { InstrumentVisualParameters } from './visualParameters.ts';

export interface WeatherInstrumentState {
  readonly visualParameters: InstrumentVisualParameters;
  readonly audioParameters: InstrumentAudioParameters;
  readonly sourceLabel: string;
}

export function loadFixtureWeatherInstrumentState(): Promise<WeatherInstrumentState> {
  const archive = loadReplayArchives()[0];

  if (archive === undefined) {
    throw new Error('Expected at least one recorded weather replay archive.');
  }

  return Promise.resolve(evaluateReplayFrame(archive, 0));
}
