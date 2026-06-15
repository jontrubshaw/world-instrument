import { describe, expect, it } from 'vitest';

import {
  serializeAudioParametersForDom,
  type InstrumentAudioParameters,
} from '../src/audioParameters.ts';
import { createReplayScoreSequence, loadReplayArchives } from '../src/replayArchive.ts';
import { loadFixtureWeatherInstrumentState } from '../src/weatherInstrument.ts';

describe('weather score audio parameters', () => {
  it('maps the fixture weather score into a stable Web Audio plan', async () => {
    const state = await loadFixtureWeatherInstrumentState();

    expect(state.audioParameters).toEqual({
      scoreId: 'weather-score',
      scoreVersion: '1.0.0',
      frameIndex: 0,
      generatedAt: '2026-06-14T21:00:00.000Z',
      signature: '8f5c7a72',
      enabled: true,
      carrierFrequencyHz: 168.41,
      harmonicDetuneCents: -4.788,
      filterFrequencyHz: 769.84,
      modulationFrequencyHz: 1.013,
      gain: 0.052,
      textureGain: 0.003,
    } satisfies InstrumentAudioParameters);
  });

  it('replays the same fixture into identical audio parameters', async () => {
    const first = await loadFixtureWeatherInstrumentState();
    const second = await loadFixtureWeatherInstrumentState();

    expect(second.audioParameters).toEqual(first.audioParameters);
  });

  it('produces a deterministic audio parameter sequence from an archive', () => {
    const archive = loadReplayArchives()[0];

    if (archive === undefined) {
      throw new Error('Expected at least one replay archive.');
    }

    const firstRun = createReplayScoreSequence(archive).map((output) => output.audio);
    const secondRun = createReplayScoreSequence(archive).map((output) => output.audio);

    expect(secondRun).toEqual(firstRun);
    expect(firstRun).toHaveLength(3);
  });

  it('serializes a compact score-driven audio signature', async () => {
    const state = await loadFixtureWeatherInstrumentState();

    expect(JSON.parse(serializeAudioParametersForDom(state.audioParameters))).toEqual({
      signature: '8f5c7a72',
      enabled: true,
      carrierFrequencyHz: 168.41,
      filterFrequencyHz: 769.84,
      modulationFrequencyHz: 1.013,
      gain: 0.052,
      textureGain: 0.003,
    });
  });
});
