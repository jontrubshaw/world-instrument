import { describe, expect, it } from 'vitest';

import {
  RECORDED_WEATHER_SCHEMA_VERSION,
  WeatherAdapter,
  normalizeWeatherObservation,
  type WeatherAdapterFailurePayload,
  type RecordedWeatherPayload,
} from '../src/index.js';

import londonWeatherFixture from './fixtures/london-weather.v1.json';

const londonWeather = londonWeatherFixture as RecordedWeatherPayload;

describe('weather adapter', () => {
  it('normalizes recorded weather fixtures into core stream state without credentials', async () => {
    const adapter = new WeatherAdapter({
      mode: 'fixture',
      fixture: londonWeather,
    });

    const result = await adapter.read();
    const raw = result.raw as RecordedWeatherPayload;

    expect(raw.schemaVersion).toBe(RECORDED_WEATHER_SCHEMA_VERSION);
    expect(result.state).toEqual(normalizeWeatherObservation(londonWeather));
    expect(result.state).toMatchObject({
      schemaVersion: 'stream-state.v1',
      streamId: 'weather:london',
      source: {
        id: 'open-meteo:london',
        kind: 'weather',
        label: 'London weather',
        uri: 'https://api.open-meteo.com',
      },
      status: 'ok',
      observedAt: '2026-06-14T20:00:00.000Z',
      receivedAt: '2026-06-14T20:00:01.000Z',
      sequence: 42,
    });
    expect(result.state.samples).toEqual([
      {
        kind: 'numeric',
        key: 'temperature',
        label: 'Temperature',
        observedAt: '2026-06-14T20:00:00.000Z',
        quality: 'measured',
        value: 18.4,
        unit: 'celsius',
        delta: 0.2,
        rollingAverage: 17.9,
      },
      {
        kind: 'numeric',
        key: 'windSpeed',
        label: 'Wind speed',
        observedAt: '2026-06-14T20:00:00.000Z',
        quality: 'measured',
        value: 6.8,
        unit: 'm/s',
      },
      {
        kind: 'categorical',
        key: 'condition',
        label: 'Condition',
        observedAt: '2026-06-14T20:00:00.000Z',
        quality: 'measured',
        value: 'cloudy',
        confidence: 0.83,
      },
      {
        kind: 'boolean',
        key: 'isRaining',
        label: 'Is raining',
        observedAt: '2026-06-14T20:00:00.000Z',
        quality: 'measured',
        value: false,
        confidence: 0.91,
      },
      {
        kind: 'vector',
        key: 'windVector',
        label: 'Wind vector',
        observedAt: '2026-06-14T20:00:00.000Z',
        quality: 'estimated',
        values: [0.2, 0.8],
        axes: ['x', 'y'],
        unit: 'normalized',
      },
    ]);
  });

  it('returns a clear error state when live mode is used without credentials', async () => {
    const adapter = new WeatherAdapter({
      mode: 'live',
      provider: {
        id: 'open-meteo',
        label: 'Open-Meteo',
      },
      location: {
        id: 'london',
        label: 'London',
        latitude: 51.5,
        longitude: -0.12,
      },
      requestedAt: '2026-06-14T20:05:00.000Z',
    });

    const result = await adapter.read({ afterSequence: 42 });
    const raw = result.raw as WeatherAdapterFailurePayload;

    expect(raw.error).toEqual({
      code: 'missing_credentials',
      message: 'Live weather mode requires provider credentials before weather can be read.',
      provider: 'open-meteo',
    });
    expect(result.state.status).toBe('error');
    expect(result.state.sequence).toBe(43);
    expect(result.state.metadata).toMatchObject({
      mode: 'live',
      provider: 'open-meteo',
      error: {
        code: 'missing_credentials',
      },
    });
    expect(result.state.samples.every((sample) => sample.quality === 'missing')).toBe(true);
  });
});
