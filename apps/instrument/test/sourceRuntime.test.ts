import {
  BROWSER_SENSOR_STREAM_SOURCE_ID,
  WEATHER_STREAM_SOURCE_ID,
  createBrowserSensorFixturePayload,
} from '@world-instrument/adapters';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_INSTRUMENT_SOURCE_ID,
  FIXTURE_BROWSER_SENSOR_SEED,
  FIXTURE_WEATHER_SEED,
  instrumentSourceDefinitions,
  liveRefreshIntervalForSource,
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
    expect(liveRefreshIntervalForSource(BROWSER_SENSOR_STREAM_SOURCE_ID)).toBe(500);
    expect(sourceCapabilitySummary(instrumentSourceDefinitions[0] ?? missingSource())).toContain(
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

  it('routes a registry browser sensor fixture through the shared output pipeline', async () => {
    const frame = await readSourceFrame({
      sourceId: BROWSER_SENSOR_STREAM_SOURCE_ID,
      sourceMode: 'fixture',
    });

    expect(frame).toMatchObject({
      sourceId: BROWSER_SENSOR_STREAM_SOURCE_ID,
      sourceName: 'Browser sensors',
      sourceMode: 'fixture',
      status: 'degraded',
      seed: FIXTURE_BROWSER_SENSOR_SEED,
      frame: {
        sourceMode: 'fixture',
        seed: FIXTURE_BROWSER_SENSOR_SEED,
        sourceLabel: 'Studio browser sensor',
        visualParameters: {
          scoreId: 'sensor-score',
          condition: 'sensor-pointer-active',
        },
        audioParameters: {
          scoreId: 'sensor-score',
        },
        hapticPattern: {
          scoreId: 'sensor-score',
        },
      },
      streamState: {
        source: {
          kind: 'sensor',
          label: 'Studio browser sensor',
        },
        status: 'degraded',
        metadata: {
          mode: 'fixture',
        },
      },
    });
    expect(
      frame.streamState?.samples.find((sample) => sample.key === 'pointerPosition'),
    ).toMatchObject({
      key: 'pointerPosition',
      kind: 'vector',
      values: [0.62, 0.38],
    });
  });

  it('routes live browser sensor frames through the shared output pipeline', async () => {
    const frame = await readSourceFrame({
      sourceId: BROWSER_SENSOR_STREAM_SOURCE_ID,
      sourceMode: 'live',
      now: new Date('2026-06-15T12:05:01.000Z'),
      readSensor: () =>
        createBrowserSensorFixturePayload({
          observedAt: '2026-06-15T12:05:01.000Z',
          pointerX: 0.25,
          pointerY: 0.75,
          deltaX: 0.08,
          deltaY: -0.02,
          motion: [0.2, 0.1, 9.8],
          orientation: [30, 8, -12],
        }),
    });

    expect(frame).toMatchObject({
      sourceId: BROWSER_SENSOR_STREAM_SOURCE_ID,
      sourceName: 'Browser sensors',
      sourceMode: 'live',
      status: 'ready',
      seed: 'world-instrument-live-browser-sensor-v1',
      frame: {
        visualParameters: {
          scoreId: 'sensor-score',
          condition: 'sensor-motion-active',
        },
      },
      streamState: {
        status: 'ok',
        metadata: {
          capability: {
            fallback: 'none',
          },
        },
      },
    });
  });

  it('marks old browser sensor observations as stale while preserving output', async () => {
    const frame = await readSourceFrame({
      sourceId: BROWSER_SENSOR_STREAM_SOURCE_ID,
      sourceMode: 'live',
      now: new Date('2026-06-15T12:05:20.000Z'),
      staleAfterMs: 1_000,
      readSensor: () =>
        createBrowserSensorFixturePayload({
          observedAt: '2026-06-15T12:05:01.000Z',
          pointerX: 0.4,
          pointerY: 0.45,
        }),
    });

    expect(frame).toMatchObject({
      status: 'stale',
      message: 'Browser sensor input is stale; outputs are using the latest interaction frame.',
      frame: {
        visualParameters: {
          scoreId: 'sensor-score',
        },
      },
      streamState: {
        status: 'stale',
      },
    });
  });
});

function missingSource(): never {
  throw new Error('Expected at least one registered source.');
}
