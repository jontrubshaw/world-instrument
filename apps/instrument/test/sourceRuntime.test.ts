import {
  BROWSER_SENSOR_STREAM_SOURCE_ID,
  WEATHER_STREAM_SOURCE_ID,
  createDeterministicBrowserSensorSnapshot,
} from '@world-instrument/adapters';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_INSTRUMENT_SOURCE_ID,
  FIXTURE_BROWSER_SENSOR_SEED,
  FIXTURE_WEATHER_SEED,
  LIVE_BROWSER_SENSOR_SEED,
  browserSensorStaleRefreshDelayMs,
  instrumentSourceDefinitions,
  readSourceFrame,
  selectableModeForSource,
  sourceCapabilitySummary,
  sourceHasCompatibleScore,
  sourceSupportsMode,
} from '../src/sourceRuntime.ts';

describe('instrument source runtime', () => {
  it('exposes registered sources and capabilities to the app', () => {
    expect(DEFAULT_INSTRUMENT_SOURCE_ID).toBe(WEATHER_STREAM_SOURCE_ID);
    expect(instrumentSourceDefinitions.map((definition) => definition.id)).toEqual([
      WEATHER_STREAM_SOURCE_ID,
      BROWSER_SENSOR_STREAM_SOURCE_ID,
    ]);
    expect(sourceSupportsMode(WEATHER_STREAM_SOURCE_ID, 'live')).toBe(true);
    expect(sourceSupportsMode(BROWSER_SENSOR_STREAM_SOURCE_ID, 'fixture')).toBe(true);
    expect(sourceSupportsMode(BROWSER_SENSOR_STREAM_SOURCE_ID, 'live')).toBe(true);
    expect(sourceHasCompatibleScore(WEATHER_STREAM_SOURCE_ID)).toBe(true);
    expect(sourceHasCompatibleScore(BROWSER_SENSOR_STREAM_SOURCE_ID)).toBe(true);
    expect(selectableModeForSource(BROWSER_SENSOR_STREAM_SOURCE_ID, 'live')).toBe('live');
    expect(sourceCapabilitySummary(instrumentSourceDefinitions[0] ?? missingSource())).toContain(
      'score-ready',
    );
    expect(sourceCapabilitySummary(instrumentSourceDefinitions[1] ?? missingSource())).toContain(
      'score-ready',
    );
  });

  it('routes a registry weather fixture through the shared output pipeline', async () => {
    const frame = await readSourceFrame({
      sourceId: WEATHER_STREAM_SOURCE_ID,
      sourceMode: 'fixture',
    });

    expect(frame).toMatchObject({
      sourceId: WEATHER_STREAM_SOURCE_ID,
      sourceName: 'Open-Meteo weather',
      sourceMode: 'fixture',
      status: 'ready',
      seed: FIXTURE_WEATHER_SEED,
      frame: {
        sourceMode: 'fixture',
        seed: FIXTURE_WEATHER_SEED,
        sourceLabel: 'London, UK weather',
        visualParameters: {
          scoreId: 'weather-score',
          condition: 'overcast',
        },
        audioParameters: {
          scoreId: 'weather-score',
        },
        hapticPattern: {
          scoreId: 'weather-score',
        },
      },
      streamState: {
        source: {
          kind: 'weather',
        },
        metadata: {
          mode: 'fixture',
        },
      },
    });
  });

  it('routes a browser sensor fixture through the shared output pipeline', async () => {
    const frame = await readSourceFrame({
      sourceId: BROWSER_SENSOR_STREAM_SOURCE_ID,
      sourceMode: 'fixture',
    });

    expect(frame).toMatchObject({
      sourceId: BROWSER_SENSOR_STREAM_SOURCE_ID,
      sourceName: 'Browser sensor / interaction',
      sourceMode: 'fixture',
      status: 'ready',
      seed: FIXTURE_BROWSER_SENSOR_SEED,
      frame: {
        sourceMode: 'fixture',
        seed: FIXTURE_BROWSER_SENSOR_SEED,
        sourceLabel: 'Studio browser sensor',
        visualParameters: {
          scoreId: 'browser-sensor-score',
          condition: 'sensor-touch',
        },
        audioParameters: {
          scoreId: 'browser-sensor-score',
          enabled: true,
        },
        hapticPattern: {
          scoreId: 'browser-sensor-score',
        },
      },
      streamState: {
        source: {
          kind: 'sensor',
          label: 'Studio browser sensor',
        },
        metadata: {
          activeInputs: ['pointer', 'deviceMotion', 'deviceOrientation'],
        },
      },
    });
    expect(
      frame.streamState?.samples.find((sample) => sample.key === 'pointerPosition'),
    ).toMatchObject({
      key: 'pointerPosition',
      kind: 'vector',
    });
  });

  it('routes live browser sensor snapshots and reports pointer fallback capability state', async () => {
    const sensorSnapshot = createDeterministicBrowserSensorSnapshot({
      observedAt: '2026-06-15T12:00:00.000Z',
      receivedAt: '2026-06-15T12:00:00.200Z',
    });

    const frame = await readSourceFrame({
      sourceId: BROWSER_SENSOR_STREAM_SOURCE_ID,
      sourceMode: 'live',
      now: new Date('2026-06-15T12:00:01.000Z'),
      browserSensorSnapshot: {
        provider: sensorSnapshot.provider,
        observedAt: sensorSnapshot.observedAt,
        ...(sensorSnapshot.receivedAt === undefined
          ? {}
          : { receivedAt: sensorSnapshot.receivedAt }),
        device: sensorSnapshot.device,
        ...(sensorSnapshot.pointer === undefined ? {} : { pointer: sensorSnapshot.pointer }),
        capabilities: {
          pointer: 'available',
          deviceMotion: 'permission-required',
          deviceOrientation: 'unavailable',
          permission: 'not-requested',
          fallback: 'pointer',
        },
      },
    });

    expect(frame).toMatchObject({
      sourceId: BROWSER_SENSOR_STREAM_SOURCE_ID,
      sourceName: 'Browser sensor / interaction',
      sourceMode: 'live',
      status: 'ready',
      seed: LIVE_BROWSER_SENSOR_SEED,
      message:
        'Browser sensor / interaction pointer fallback is driving the instrument; motion/orientation sensors are unavailable or waiting for permission.',
      frame: {
        streamStatus: 'degraded',
        output: {
          scoreId: 'browser-sensor-score',
          scoreVersion: '1.0.0',
        },
        visualParameters: {
          scoreId: 'browser-sensor-score',
          condition: 'sensor-touch',
        },
      },
      streamState: {
        status: 'degraded',
        metadata: {
          capabilities: {
            deviceMotion: 'permission-required',
            fallback: 'pointer',
          },
          activeInputs: ['pointer'],
        },
      },
    });
  });

  it('reports stale live browser sensor snapshots without leaving the shared pipeline', async () => {
    const frame = await readSourceFrame({
      sourceId: BROWSER_SENSOR_STREAM_SOURCE_ID,
      sourceMode: 'live',
      now: new Date('2026-06-15T12:00:05.000Z'),
      staleAfterMs: 1_000,
      browserSensorSnapshot: createDeterministicBrowserSensorSnapshot({
        observedAt: '2026-06-15T12:00:00.000Z',
      }),
    });

    expect(frame).toMatchObject({
      sourceId: BROWSER_SENSOR_STREAM_SOURCE_ID,
      sourceName: 'Browser sensor / interaction',
      sourceMode: 'live',
      status: 'stale',
      message:
        'Browser sensor / interaction input is stale; move the pointer or enable device sensors to refresh the instrument.',
      frame: {
        streamStatus: 'stale',
        output: {
          scoreId: 'browser-sensor-score',
        },
        visualParameters: {
          scoreId: 'browser-sensor-score',
          condition: 'sensor-stale',
        },
      },
    });
  });

  it('calculates the browser sensor stale refresh deadline for stopped input', () => {
    expect(
      browserSensorStaleRefreshDelayMs(
        '2026-06-15T12:00:00.000Z',
        new Date('2026-06-15T12:00:02.000Z'),
      ),
    ).toBe(1_000);
    expect(
      browserSensorStaleRefreshDelayMs(
        '2026-06-15T12:00:00.000Z',
        new Date('2026-06-15T12:00:03.000Z'),
      ),
    ).toBe(0);
    expect(browserSensorStaleRefreshDelayMs('not-a-date')).toBeUndefined();
  });
});

function missingSource(): never {
  throw new Error('Expected at least one registered source.');
}
