import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

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
});

async function loadFixture(): Promise<RecordedWeatherPayload> {
  const contents = await readFile(
    new URL('./fixtures/open-meteo-london-current.v1.json', import.meta.url),
    'utf8',
  );

  return JSON.parse(contents) as RecordedWeatherPayload;
}
