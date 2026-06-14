import { readFile } from 'node:fs/promises';

import { describe, expect, it, vi } from 'vitest';

import { STREAM_STATE_SCHEMA_VERSION } from '@world-instrument/core';

import {
  WEATHER_ADAPTER_ID,
  WeatherAdapter,
  normalizeWeatherPayload,
  type RecordedWeatherPayload,
} from '../src/index.ts';

describe('weather adapter', () => {
  it('normalizes recorded fixture weather without credentials', async () => {
    const fixture = await loadFixture();
    const adapter = new WeatherAdapter({
      mode: 'fixture',
      fixture,
      sequence: 7,
    });

    const result = await adapter.read();

    expect(result.raw).toBe(fixture);
    expect(result.state).toMatchObject({
      schemaVersion: STREAM_STATE_SCHEMA_VERSION,
      streamId: 'weather:london-uk',
      status: 'ok',
      observedAt: '2026-06-14T21:00:00.000Z',
      receivedAt: '2026-06-14T21:00:01.000Z',
      sequence: 7,
      source: {
        id: `${WEATHER_ADAPTER_ID}:london-uk`,
        kind: 'weather',
        label: 'London, UK weather',
      },
      metadata: {
        provider: 'open-meteo',
        mode: 'fixture',
        condition: 'overcast',
        weatherCode: 3,
      },
    });
    expect(result.state.samples).toHaveLength(11);
    expect(result.state.samples.find((sample) => sample.key === 'temperature')).toMatchObject({
      kind: 'numeric',
      value: 18.4,
      quality: 'measured',
      unit: 'celsius',
    });
    expect(result.state.samples.find((sample) => sample.key === 'condition')).toMatchObject({
      kind: 'categorical',
      value: 'overcast',
      quality: 'estimated',
    });
    expect(result.state.samples.find((sample) => sample.key === 'windVector')).toMatchObject({
      kind: 'vector',
      values: [-0.21, -0.085],
      axes: ['east', 'north'],
    });
  });

  it('normalizes fixtures through the standalone helper', async () => {
    const fixture = await loadFixture();

    expect(
      normalizeWeatherPayload(fixture, {
        sequence: 9,
        streamId: 'weather:test-london',
      }),
    ).toMatchObject({
      streamId: 'weather:test-london',
      sequence: 9,
      status: 'ok',
    });
  });

  it('classifies Open-Meteo snow shower weather codes as snow', async () => {
    const fixture = await loadFixture();

    for (const weatherCode of [85, 86]) {
      const state = normalizeWeatherPayload({
        ...fixture,
        current: {
          ...fixture.current,
          weatherCode,
        },
      });

      expect(state.metadata).toMatchObject({
        condition: 'snow',
        weatherCode,
      });
      expect(state.samples.find((sample) => sample.key === 'condition')).toMatchObject({
        kind: 'categorical',
        value: 'snow',
      });
    }
  });

  it('maps Open-Meteo live responses into normalized weather state', async () => {
    let requestedUrl: string | undefined;
    const adapter = new WeatherAdapter({
      mode: 'live',
      endpointUrl: 'https://api.open-meteo.com/v1/forecast',
      apiKey: 'test-api-key',
      receivedAt: '2026-06-14T21:05:00.000Z',
      location: {
        id: 'london-uk',
        label: 'London, UK',
        latitude: 51.5072,
        longitude: -0.1276,
      },
      fetchWeather: (url) => {
        requestedUrl = url;

        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              latitude: 51.5,
              longitude: -0.12,
              timezone: 'GMT',
              current: {
                time: '2026-06-14T21:00',
                temperature_2m: 18.4,
                apparent_temperature: 17.9,
                relative_humidity_2m: 72,
                precipitation: 0.1,
                rain: 0,
                weather_code: 3,
                cloud_cover: 86,
                surface_pressure: 1012.4,
                wind_speed_10m: 6.8,
                wind_direction_10m: 248,
              },
            }),
        });
      },
    });

    const result = await adapter.read({ afterSequence: 4 });

    expect(requestedUrl).toBeDefined();
    const url = new URL(requestedUrl ?? '');
    expect(url.searchParams.get('latitude')).toBe('51.5072');
    expect(url.searchParams.get('longitude')).toBe('-0.1276');
    expect(url.searchParams.get('apikey')).toBe('test-api-key');
    expect(url.searchParams.get('timezone')).toBe('GMT');
    expect(url.searchParams.get('wind_speed_unit')).toBe('ms');
    expect(url.searchParams.get('current')).toBe(
      [
        'temperature_2m',
        'apparent_temperature',
        'relative_humidity_2m',
        'precipitation',
        'rain',
        'weather_code',
        'cloud_cover',
        'surface_pressure',
        'wind_speed_10m',
        'wind_direction_10m',
      ].join(','),
    );
    url.searchParams.delete('apikey');
    const expectedSourceUri = url.toString();
    expect(result.raw).toMatchObject({
      provider: 'open-meteo',
      observedAt: '2026-06-14T21:00:00.000Z',
      receivedAt: '2026-06-14T21:05:00.000Z',
      sourceUri: expectedSourceUri,
      location: {
        id: 'london-uk',
        label: 'London, UK',
        timezone: 'GMT',
      },
      current: {
        temperatureCelsius: 18.4,
        apparentTemperatureCelsius: 17.9,
        relativeHumidityPercent: 72,
        precipitationMm: 0.1,
        rainMm: 0,
        weatherCode: 3,
        cloudCoverPercent: 86,
        pressureHpa: 1012.4,
        windSpeedMetersPerSecond: 6.8,
        windDirectionDegrees: 248,
      },
    });
    expect(result.state).toMatchObject({
      streamId: 'weather:london-uk',
      status: 'ok',
      observedAt: '2026-06-14T21:00:00.000Z',
      receivedAt: '2026-06-14T21:05:00.000Z',
      sequence: 5,
      source: {
        uri: expectedSourceUri,
      },
      metadata: {
        provider: 'open-meteo',
        mode: 'live',
        condition: 'overcast',
        weatherCode: 3,
      },
    });
    expect(result.state.samples.find((sample) => sample.key === 'temperature')).toMatchObject({
      kind: 'numeric',
      value: 18.4,
      quality: 'measured',
    });
    expect(JSON.stringify(result.raw)).not.toContain('test-api-key');
    expect(JSON.stringify(result.state)).not.toContain('test-api-key');
  });

  it('returns a clear error stream state when live credentials are missing', async () => {
    const envName = 'WORLD_INSTRUMENT_TEST_WEATHER_API_KEY';
    const previousValue = process.env.WORLD_INSTRUMENT_TEST_WEATHER_API_KEY;
    delete process.env.WORLD_INSTRUMENT_TEST_WEATHER_API_KEY;

    try {
      const adapter = new WeatherAdapter({
        mode: 'live',
        endpointUrl: 'https://weather.example.test/current',
        credentialEnvName: envName,
        receivedAt: '2026-06-14T21:05:00.000Z',
        location: {
          id: 'london-uk',
          label: 'London, UK',
          latitude: 51.5072,
          longitude: -0.1276,
        },
      });

      const result = await adapter.read({ afterSequence: 41 });

      expect(result.raw).toMatchObject({
        ok: false,
        error: {
          code: 'missing-credentials',
          message: `Weather live mode requires apiKey or ${envName}.`,
        },
      });
      expect(result.state).toMatchObject({
        status: 'error',
        streamId: 'weather:london-uk',
        sequence: 42,
        metadata: {
          provider: 'live',
          mode: 'live',
          error: {
            code: 'missing-credentials',
          },
        },
      });
      expect(result.state.samples.every((sample) => sample.quality === 'missing')).toBe(true);
    } finally {
      if (previousValue === undefined) {
        delete process.env.WORLD_INSTRUMENT_TEST_WEATHER_API_KEY;
      } else {
        process.env.WORLD_INSTRUMENT_TEST_WEATHER_API_KEY = previousValue;
      }
    }
  });

  it('returns missing credentials instead of crashing when process is unavailable', async () => {
    const originalProcess = globalThis.process;
    vi.stubGlobal('process', undefined);

    try {
      const adapter = new WeatherAdapter({
        mode: 'live',
        endpointUrl: 'https://weather.example.test/current',
        receivedAt: '2026-06-14T21:05:00.000Z',
        location: {
          id: 'london-uk',
          label: 'London, UK',
          latitude: 51.5072,
          longitude: -0.1276,
        },
      });

      const result = await adapter.read();

      expect(result.raw).toMatchObject({
        ok: false,
        error: {
          code: 'missing-credentials',
          message: 'Weather live mode requires apiKey or WORLD_INSTRUMENT_WEATHER_API_KEY.',
        },
      });
      expect(result.state.status).toBe('error');
    } finally {
      vi.stubGlobal('process', originalProcess);
    }
  });
});

async function loadFixture(): Promise<RecordedWeatherPayload> {
  const contents = await readFile(
    new URL('./fixtures/open-meteo-london-current.v1.json', import.meta.url),
    'utf8',
  );

  return JSON.parse(contents) as RecordedWeatherPayload;
}
