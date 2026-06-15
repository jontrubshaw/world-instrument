import { MOCK_SENSOR_STREAM_SOURCE_ID, WEATHER_STREAM_SOURCE_ID } from '@world-instrument/adapters';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_INSTRUMENT_SOURCE_ID,
  FIXTURE_WEATHER_SEED,
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
      MOCK_SENSOR_STREAM_SOURCE_ID,
    ]);
    expect(sourceSupportsMode(WEATHER_STREAM_SOURCE_ID, 'live')).toBe(true);
    expect(sourceSupportsMode(MOCK_SENSOR_STREAM_SOURCE_ID, 'fixture')).toBe(true);
    expect(sourceSupportsMode(MOCK_SENSOR_STREAM_SOURCE_ID, 'live')).toBe(false);
    expect(sourceHasCompatibleScore(WEATHER_STREAM_SOURCE_ID)).toBe(true);
    expect(sourceHasCompatibleScore(MOCK_SENSOR_STREAM_SOURCE_ID)).toBe(false);
    expect(selectableModeForSource(MOCK_SENSOR_STREAM_SOURCE_ID, 'live')).toBe('fixture');
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

  it('surfaces a non-weather fixture as registered but score-unavailable', async () => {
    const frame = await readSourceFrame({
      sourceId: MOCK_SENSOR_STREAM_SOURCE_ID,
      sourceMode: 'fixture',
    });

    expect(frame).toMatchObject({
      sourceId: MOCK_SENSOR_STREAM_SOURCE_ID,
      sourceName: 'Mock local sensor',
      sourceMode: 'fixture',
      status: 'unavailable',
      message:
        'Mock local sensor fixture is available, but no compatible score is registered yet; replay remains available.',
      streamState: {
        source: {
          kind: 'sensor',
          label: 'Studio Controller sensor',
        },
        samples: expect.arrayContaining([
          expect.objectContaining({
            key: 'acceleration',
            kind: 'vector',
          }),
        ]),
      },
    });
    expect(frame.frame).toBeUndefined();
  });

  it('reports unsupported modes without invoking an unavailable source path', async () => {
    const frame = await readSourceFrame({
      sourceId: MOCK_SENSOR_STREAM_SOURCE_ID,
      sourceMode: 'live',
    });

    expect(frame).toEqual({
      sourceId: MOCK_SENSOR_STREAM_SOURCE_ID,
      sourceName: 'Mock local sensor',
      sourceMode: 'live',
      status: 'unavailable',
      message: 'Mock local sensor does not support live input yet.',
    });
  });
});

function missingSource(): never {
  throw new Error('Expected at least one registered source.');
}
