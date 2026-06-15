import { describe, expect, it } from 'vitest';

import {
  loadWeatherInstrumentState,
  mapWeatherScoreToInstrumentScene,
} from '../src/weatherInstrument.ts';

describe('weather instrument scene mapping', () => {
  it('loads the recorded weather fixture through the adapter and score', async () => {
    const state = await loadWeatherInstrumentState();

    expect(state.label).toBe('London, UK weather');
    expect(state.observedAt).toBe('2026-06-14T21:00:00.000Z');
    expect(state.score).toMatchObject({
      scoreId: 'weather-score',
      scoreVersion: '1.0.0',
      frameIndex: 0,
      generatedAt: '2026-06-14T21:00:00.000Z',
      metadata: {
        streamStatus: 'ok',
        streamId: 'weather:london-uk',
        condition: 'overcast',
      },
    });
    expect(state.visual).toEqual({
      palette: {
        background: '#0b1026',
        body: '#7fb7ff',
        accent: '#d8b4fe',
      },
      condition: 'overcast',
      streamStatus: 'ok',
      inputHash: '8f5c7a72',
      bodyScale: 1.156,
      pulseAmplitude: 0.062,
      pulseRate: 1.619,
      rotationRate: {
        x: 0.215,
        y: 0.281,
        inner: 0.418,
      },
      wireOpacity: 0.315,
      innerOpacity: 0.469,
      innerScale: 1.307,
      emissiveIntensity: 0.842,
      roughness: 0.507,
      metalness: 0.374,
      keyLightIntensity: 4.744,
      fillLightIntensity: 2.655,
      fog: {
        near: 2.786,
        far: 7.65,
      },
    });
  });

  it('maps identical score output into stable visual parameters', async () => {
    const first = await loadWeatherInstrumentState();
    const second = await loadWeatherInstrumentState();

    expect(second.score).toEqual(first.score);
    expect(mapWeatherScoreToInstrumentScene(second.score)).toEqual(
      mapWeatherScoreToInstrumentScene(first.score),
    );
  });
});
