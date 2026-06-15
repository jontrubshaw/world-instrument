import { describe, expect, it } from 'vitest';

import {
  STREAM_SOURCE_REGISTRY_SCHEMA_VERSION,
  STREAM_STATE_SCHEMA_VERSION,
  isStreamSourceCompatibleWithScore,
  type ScoreVersionMetadata,
} from '@world-instrument/core';

import {
  BROWSER_SENSOR_ADAPTER_ID,
  BROWSER_SENSOR_STREAM_SOURCE_ID,
  BrowserSensorAdapter,
  WEATHER_ADAPTER_ID,
  WEATHER_STREAM_SOURCE_ID,
  WeatherAdapter,
  browserSensorStreamSourceDefinition,
  createRegisteredStreamAdapter,
  createDeterministicBrowserSensorSnapshot,
  normalizeBrowserSensorPayload,
  streamSourceRegistry,
  weatherStreamSourceDefinition,
  type RecordedBrowserSensorPayload,
} from '../src/index.ts';

describe('stream source registry', () => {
  it('catalogs weather and non-weather source capabilities', () => {
    expect(streamSourceRegistry.list().map((definition) => definition.id)).toEqual([
      WEATHER_STREAM_SOURCE_ID,
      BROWSER_SENSOR_STREAM_SOURCE_ID,
    ]);
    expect(streamSourceRegistry.require(WEATHER_STREAM_SOURCE_ID)).toBe(
      weatherStreamSourceDefinition,
    );
    expect(streamSourceRegistry.require(BROWSER_SENSOR_STREAM_SOURCE_ID)).toBe(
      browserSensorStreamSourceDefinition,
    );

    expect(streamSourceRegistry.supports(WEATHER_STREAM_SOURCE_ID, 'fixture')).toBe(true);
    expect(streamSourceRegistry.supports(WEATHER_STREAM_SOURCE_ID, 'live')).toBe(true);
    expect(streamSourceRegistry.supports(WEATHER_STREAM_SOURCE_ID, 'replay')).toBe(true);
    expect(streamSourceRegistry.supports(BROWSER_SENSOR_STREAM_SOURCE_ID, 'fixture')).toBe(true);
    expect(streamSourceRegistry.supports(BROWSER_SENSOR_STREAM_SOURCE_ID, 'live')).toBe(true);
    expect(streamSourceRegistry.supports(BROWSER_SENSOR_STREAM_SOURCE_ID, 'replay')).toBe(true);
    expect(streamSourceRegistry.listByMode('live').map((definition) => definition.id)).toEqual([
      WEATHER_STREAM_SOURCE_ID,
      BROWSER_SENSOR_STREAM_SOURCE_ID,
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
    expect(browserSensorStreamSourceDefinition).toMatchObject({
      adapter: {
        id: BROWSER_SENSOR_ADAPTER_ID,
      },
      mapping: {
        streamKind: 'sensor',
        streamIdPrefix: 'sensor',
      },
      defaultScoreId: 'weather-score',
    });
    expect(browserSensorStreamSourceDefinition.mapping.samples.map((sample) => sample.key)).toEqual(
      [
        'pointerPosition',
        'pointerVelocity',
        'pointerPressure',
        'interactionActive',
        'acceleration',
        'rotationRate',
        'orientation',
        'motionIntensity',
      ],
    );
  });

  it('checks source compatibility against score metadata', () => {
    expect(
      isStreamSourceCompatibleWithScore(weatherStreamSourceDefinition, weatherScoreMetadata),
    ).toBe(true);
    expect(
      streamSourceRegistry
        .compatibleSourcesForScore(weatherScoreMetadata)
        .map((source) => source.id),
    ).toEqual([WEATHER_STREAM_SOURCE_ID, BROWSER_SENSOR_STREAM_SOURCE_ID]);
    expect(
      streamSourceRegistry.compatibleScoresForSource(WEATHER_STREAM_SOURCE_ID, [
        weatherScoreMetadata,
        incompatibleScoreMetadata,
      ]),
    ).toEqual([weatherScoreMetadata]);
    expect(
      streamSourceRegistry.compatibleScoresForSource(BROWSER_SENSOR_STREAM_SOURCE_ID, [
        weatherScoreMetadata,
      ]),
    ).toEqual([weatherScoreMetadata]);
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
    const sensorAdapter = createRegisteredStreamAdapter(BROWSER_SENSOR_STREAM_SOURCE_ID, {
      mode: 'fixture',
      fixture: sensorFixture,
    });

    expect(weatherAdapter).toBeInstanceOf(WeatherAdapter);
    expect(sensorAdapter).toBeInstanceOf(BrowserSensorAdapter);
    expect(() =>
      createRegisteredStreamAdapter('news.mock', {
        mode: 'fixture',
        fixture: sensorFixture,
      }),
    ).toThrow("Stream source 'news.mock' is not registered with an adapter factory.");
  });

  it('normalizes browser sensor payloads through the shared stream state contract', async () => {
    const adapter = new BrowserSensorAdapter({
      mode: 'fixture',
      fixture: sensorFixture,
      sequence: 3,
    });

    const result = await adapter.read();

    expect(result.raw).toBe(sensorFixture);
    expect(result.state).toMatchObject({
      schemaVersion: STREAM_STATE_SCHEMA_VERSION,
      streamId: 'sensor:studio-browser',
      source: {
        id: `${BROWSER_SENSOR_ADAPTER_ID}:studio-browser`,
        kind: 'sensor',
        label: 'Studio browser sensor',
      },
      status: 'ok',
      observedAt: '2026-06-15T12:00:00.000Z',
      receivedAt: '2026-06-15T12:00:01.000Z',
      sequence: 3,
      metadata: {
        provider: 'browser-sensor',
        mode: 'fixture',
        device: {
          id: 'studio-browser',
        },
        activeInputs: ['pointer', 'deviceMotion', 'deviceOrientation'],
      },
    });
    expect(result.state.samples.find((sample) => sample.key === 'pointerPosition')).toMatchObject({
      kind: 'vector',
      values: [0.5, 0.78],
      axes: ['x', 'y'],
    });
    expect(result.state.samples.find((sample) => sample.key === 'acceleration')).toMatchObject({
      kind: 'vector',
      axes: ['x', 'y', 'z'],
    });
    expect(result.state.samples.find((sample) => sample.key === 'interactionActive')).toMatchObject(
      {
        kind: 'boolean',
        value: false,
      },
    );
    expect(normalizeBrowserSensorPayload(sensorFixture, { sequence: 4 })).toMatchObject({
      streamId: 'sensor:studio-browser',
      sequence: 4,
    });
  });

  it('marks pointer-only browser sensor frames as degraded fallback input', async () => {
    const state = normalizeBrowserSensorPayload({
      ...sensorFixture,
      motion: undefined,
      orientation: undefined,
      capabilities: {
        pointer: 'available',
        deviceMotion: 'permission-required',
        deviceOrientation: 'unavailable',
        permission: 'not-requested',
        fallback: 'pointer',
      },
    });

    expect(state.status).toBe('degraded');
    expect(state.metadata).toMatchObject({
      capabilities: {
        deviceMotion: 'permission-required',
        fallback: 'pointer',
      },
      activeInputs: ['pointer'],
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

const sensorFixture: RecordedBrowserSensorPayload = createDeterministicBrowserSensorSnapshot({
  observedAt: '2026-06-15T12:00:00.000Z',
  receivedAt: '2026-06-15T12:00:01.000Z',
});
