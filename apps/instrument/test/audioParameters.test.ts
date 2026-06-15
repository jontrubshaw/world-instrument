import { describe, expect, it } from 'vitest';

import {
  mapScoreOutputToAudioPlan,
  serializeAudioPlanForDom,
  type InstrumentAudioPlan,
} from '../src/audioParameters.ts';
import { loadFixtureWeatherInstrumentState } from '../src/weatherInstrument.ts';

describe('weather score audio parameters', () => {
  it('maps the fixture weather score into a stable audio plan', async () => {
    const state = await loadFixtureWeatherInstrumentState();

    expect(state.audioPlan).toEqual({
      scoreId: 'weather-score',
      scoreVersion: '1.0.0',
      frameIndex: 0,
      generatedAt: '2026-06-14T21:00:00.000Z',
      signature: '8f5c7a72',
      enabled: true,
      carrierFrequencyHz: 211.562,
      carrierGain: 0.065,
      filterFrequencyHz: 650.68,
      filterQ: 2.18,
      detuneDepthCents: 16.208,
      modulationRateHz: 1.966,
      attackSeconds: 0.096,
      releaseSeconds: 0.164,
    } satisfies InstrumentAudioPlan);
  });

  it('replays identical score output into identical audio plans', async () => {
    const first = await loadFixtureWeatherInstrumentState();
    const second = await loadFixtureWeatherInstrumentState();

    expect(second.audioPlan).toEqual(first.audioPlan);
  });

  it('silences the plan when score audio output is disabled', async () => {
    const state = await loadFixtureWeatherInstrumentState();
    const disabledPlan = mapScoreOutputToAudioPlan({
      ...state.output,
      audio: {
        enabled: false,
        parameters: state.output.audio?.parameters ?? [],
      },
    });

    expect(disabledPlan.enabled).toBe(false);
    expect(disabledPlan.carrierGain).toBe(0);
    expect(disabledPlan.carrierFrequencyHz).toBe(state.audioPlan.carrierFrequencyHz);
  });

  it('serializes a compact score-driven audio signature for smoke tests', async () => {
    const state = await loadFixtureWeatherInstrumentState();

    expect(JSON.parse(serializeAudioPlanForDom(state.audioPlan))).toEqual({
      signature: '8f5c7a72',
      frameIndex: 0,
      carrierFrequencyHz: 211.562,
      filterFrequencyHz: 650.68,
      modulationRateHz: 1.966,
      enabled: true,
    });
  });
});
