import { describe, expect, it } from 'vitest';

import {
  STREAM_SOURCE_REGISTRY_SCHEMA_VERSION,
  STREAM_STATE_SCHEMA_VERSION,
  isStreamSourceCompatibleWithScore,
  type ScoreVersionMetadata,
} from '@world-instrument/core';

import {
  MOCK_SENSOR_ADAPTER_ID,
  MOCK_SENSOR_STREAM_SOURCE_ID,
  MockSensorAdapter,
  WEATHER_ADAPTER_ID,
  WEATHER_STREAM_SOURCE_ID,
  WeatherAdapter,
  createRegisteredStreamAdapter,
  mockSensorStreamSourceDefinition,
  normalizeMockSensorPayload,
  streamSourceRegistry,
  weatherStreamSourceDefinition,
  type RecordedMockSensorPayload,
} from '../src/index.ts';

describe('stream source registry', () => {
  it('catalogs weather and non-weather source capabilities', () => {
    expect(streamSourceRegistry.list().map((definition) => definition.id)).toEqual([
      WEATHER_STREAM_SOURCE_ID,
      MOCK_SENSOR_STREAM_SOURCE_ID,
    ]);
    expect(streamSourceRegistry.require(WEATHER_STREAM_SOURCE_ID)).toBe(
      weatherStreamSourceDefinition,
    );
    expect(streamSourceRegistry.require(MOCK_SENSOR_STREAM_SOURCE_ID)).toBe(
      mockSensorStreamSourceDefinition,
    );

    expect(streamSourceRegistry.supports(WEATHER_STREAM_SOURCE_ID, 'fixture')).toBe(true);
    expect(streamSourceRegistry.supports(WEATHER_STREAM_SOURCE_ID, 'live')).toBe(true);
    expect(streamSourceRegistry.supports(WEATHER_STREAM_SOURCE_ID, 'replay')).toBe(true);
    expect(streamSourceRegistry.supports(MOCK_SENSOR_STREAM_SOURCE_ID, 'fixture')).toBe(true);
    expect(streamSourceRegistry.supports(MOCK_SENSOR_STREAM_SOURCE_ID, 'live')).toBe(false);
    expect(streamSourceRegistry.supports(MOCK_SENSOR_STREAM_SOURCE_ID, 'replay')).toBe(true);
    expect(streamSourceRegistry.listByMode('live').map((definition) => definition.id)).toEqual([
      WEATHER_STREAM_SOURCE_ID,
    ]);
  });

  it('documents normalized mapping and score compatibility per source', () => {
    expect(weatherStreamSourceDefinition).toMatchObject({
      schemaVersion: STREAM_SOURCE_REGISTRY_SCHEMA_VERSION,
      adapter: {
        id: WEATHER_ADAPTER_ID,
      },
      mapping: {
        streamKind: 'weather',
        streamIdPrefix: 'weather',
        streamSchema: STREAM_STATE_SCHEMA_VERSION,
      },
      defaultScoreId: 'weather-score',
    });
    expect(weatherStreamSourceDefinition.mapping.samples.map((sample) => sample.key)).toEqual([
      'temperature',
      'apparentTemperature',
      'relativeHumidity',
      'precipitation',
      'rain',
      'pressure',
      'cloudCover',
      'windSpeed',
      'condition',
      'isRaining',
      'windVector',
    ]);
    expect(mockSensorStreamSourceDefinition).toMatchObject({
      adapter: {
        id: MOCK_SENSOR_ADAPTER_ID,
      },
      mapping: {
        streamKind: 'sensor',
        streamIdPrefix: 'sensor',
      },
      scoreCompatibility: [],
    });
  });

  it('checks source compatibility against score metadata', () => {
    expect(
      isStreamSourceCompatibleWithScore(weatherStreamSourceDefinition, weatherScoreMetadata),
    ).toBe(true);
    expect(
      streamSourceRegistry
        .compatibleSourcesForScore(weatherScoreMetadata)
        .map((source) => source.id),
    ).toEqual([WEATHER_STREAM_SOURCE_ID]);
    expect(
      streamSourceRegistry.compatibleScoresForSource(WEATHER_STREAM_SOURCE_ID, [
        weatherScoreMetadata,
        incompatibleScoreMetadata,
      ]),
    ).toEqual([weatherScoreMetadata]);
    expect(
      streamSourceRegistry.compatibleScoresForSource(MOCK_SENSOR_STREAM_SOURCE_ID, [
        weatherScoreMetadata,
      ]),
    ).toEqual([]);
  });

  it('creates registered adapters from source definitions', () => {
    const weatherAdapter = createRegisteredStreamAdapter(WEATHER_STREAM_SOURCE_ID, {
      mode: 'fixture',
      fixture: {
        provider: 'open-meteo',
        observedAt: '2026-06-15T12:00:00.000Z',
        location: {
          id: 'test',
          label: 'Test',
          latitude: 0,
          longitude: 0,
        },
        current: {
          temperatureCelsius: 20,
        },
      },
    });
    const sensorAdapter = createRegisteredStreamAdapter(MOCK_SENSOR_STREAM_SOURCE_ID, {
      mode: 'fixture',
      fixture: sensorFixture,
    });

    expect(weatherAdapter).toBeInstanceOf(WeatherAdapter);
    expect(sensorAdapter).toBeInstanceOf(MockSensorAdapter);
    expect(() =>
      createRegisteredStreamAdapter('news.mock', {
        mode: 'fixture',
        fixture: sensorFixture,
      }),
    ).toThrow("Stream source 'news.mock' is not registered with an adapter factory.");
  });

  it('normalizes fixture-only sensor payloads through the shared stream state contract', async () => {
    const adapter = new MockSensorAdapter({
      mode: 'fixture',
      fixture: sensorFixture,
      sequence: 3,
    });

    const result = await adapter.read();

    expect(result.raw).toBe(sensorFixture);
    expect(result.state).toMatchObject({
      schemaVersion: STREAM_STATE_SCHEMA_VERSION,
      streamId: 'sensor:studio-controller',
      source: {
        id: `${MOCK_SENSOR_ADAPTER_ID}:studio-controller`,
        kind: 'sensor',
        label: 'Studio Controller sensor',
      },
      status: 'ok',
      observedAt: '2026-06-15T12:00:00.000Z',
      receivedAt: '2026-06-15T12:00:01.000Z',
      sequence: 3,
      metadata: {
        provider: 'mock-sensor',
        mode: 'fixture',
        device: {
          id: 'studio-controller',
        },
      },
    });
    expect(result.state.samples.find((sample) => sample.key === 'acceleration')).toMatchObject({
      kind: 'vector',
      values: [0.1, -0.2, 0.3],
      axes: ['x', 'y', 'z'],
    });
    expect(result.state.samples.find((sample) => sample.key === 'contact')).toMatchObject({
      kind: 'boolean',
      value: true,
    });
    expect(normalizeMockSensorPayload(sensorFixture, { sequence: 4 })).toMatchObject({
      streamId: 'sensor:studio-controller',
      sequence: 4,
    });
  });
});

const weatherScoreMetadata: ScoreVersionMetadata = {
  schemaVersion: 'score-version.v1',
  scoreId: 'weather-score',
  scoreVersion: '1.0.0',
  displayName: 'Weather Score v1',
  deterministic: true,
  supportedStreamSchemas: [STREAM_STATE_SCHEMA_VERSION],
};

const incompatibleScoreMetadata: ScoreVersionMetadata = {
  ...weatherScoreMetadata,
  scoreId: 'sensor-score',
};

const sensorFixture: RecordedMockSensorPayload = {
  provider: 'mock-sensor',
  observedAt: '2026-06-15T12:00:00.000Z',
  receivedAt: '2026-06-15T12:00:01.000Z',
  device: {
    id: 'studio-controller',
    label: 'Studio Controller',
  },
  reading: {
    acceleration: [0.1, -0.2, 0.3],
    orientation: [12.1254, 0, 181.9876],
    contact: true,
    batteryPercent: 87.45,
  },
};
