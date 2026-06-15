import { describe, expect, it } from 'vitest';

import {
  serializeVisualParametersForCanvas,
  type InstrumentVisualParameters,
} from '../src/visualParameters.ts';
import { loadFixtureWeatherInstrumentState } from '../src/weatherInstrument.ts';

describe('weather score visual parameters', () => {
  it('maps the fixture weather score into stable scene controls', async () => {
    const state = await loadFixtureWeatherInstrumentState();

    expect(state.sourceLabel).toBe('London, UK weather');
    expect(state.visualParameters).toEqual({
      scoreId: 'weather-score',
      scoreVersion: '1.0.0',
      frameIndex: 0,
      generatedAt: '2026-06-14T21:00:00.000Z',
      condition: 'overcast',
      signature: '8f5c7a72',
      backgroundColor: '#0b1026',
      bodyColor: '#7fb7ff',
      accentColor: '#d8b4fe',
      innerColor: '#ffffff',
      emissiveColor: '#7fb7ff',
      bodyScale: 1.083,
      innerScale: 1.262,
      rotationSpeedX: 0.28,
      rotationSpeedY: 0.388,
      innerRotationSpeed: 0.715,
      pulseAmplitude: 0.083,
      pulseRate: 1.733,
      wireOpacity: 0.372,
      innerOpacity: 0.46,
      emissiveIntensity: 0.775,
      keyLightIntensity: 4.692,
      fillLightIntensity: 2.573,
      ambientIntensity: 0.816,
      fogNear: 3.609,
      fogFar: 7.692,
      glowOpacity: 0.24,
      tensionTilt: -0.064,
    } satisfies InstrumentVisualParameters);
  });

  it('replays the same fixture into identical visual parameters', async () => {
    const first = await loadFixtureWeatherInstrumentState();
    const second = await loadFixtureWeatherInstrumentState();

    expect(second.visualParameters).toEqual(first.visualParameters);
  });

  it('serializes a compact score-driven canvas signature', async () => {
    const state = await loadFixtureWeatherInstrumentState();

    expect(JSON.parse(serializeVisualParametersForCanvas(state.visualParameters))).toEqual({
      condition: 'overcast',
      signature: '8f5c7a72',
      bodyColor: '#7fb7ff',
      accentColor: '#d8b4fe',
      rotationSpeedY: 0.388,
      pulseAmplitude: 0.083,
      wireOpacity: 0.372,
      glowOpacity: 0.24,
    });
  });
});
