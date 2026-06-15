import { evaluateReplayFrame, loadReplayArchives } from './replayArchive.ts';
import type { InstrumentVisualParameters } from './visualParameters.ts';

export interface WeatherInstrumentState {
  readonly visualParameters: InstrumentVisualParameters;
  readonly sourceLabel: string;
}

export async function loadFixtureWeatherInstrumentState(): Promise<WeatherInstrumentState> {
  const archive = loadReplayArchives()[0];

  if (archive === undefined) {
    throw new Error('Expected at least one recorded weather replay archive.');
  }

  return evaluateReplayFrame(archive, 0);
}
