import { describe, expect, it, vi } from 'vitest';

import { readLiveWeatherFrame } from '../src/liveWeather.ts';

describe('live weather instrument state', () => {
  it('routes a credential-free live weather frame through the shared output pipeline', async () => {
    const firstFrame = await readLiveWeatherFrame({
      fetchWeather: createOpenMeteoFetch(),
      now: new Date('2026-06-14T21:05:00.000Z'),
      online: true,
    });
    const repeatedFrame = await readLiveWeatherFrame({
      fetchWeather: createOpenMeteoFetch(),
      now: new Date('2026-06-14T21:05:00.000Z'),
      online: true,
    });

    expect(firstFrame).toMatchObject({
      status: 'ready',
      message: 'Live weather is driving the instrument.',
      frame: {
        frameIndex: 0,
        sourceLabel: 'London, UK weather',
        statusLabel: 'overcast ready live weather',
        observedAt: '2026-06-14T21:00:00.000Z',
        receivedAt: '2026-06-14T21:05:00.000Z',
        streamStatus: 'ok',
        streamSequence: 0,
        liveStatus: 'ready',
        visualParameters: {
          scoreId: 'weather-score',
          condition: 'overcast',
        },
        audioParameters: {
          scoreId: 'weather-score',
          enabled: true,
        },
        hapticPattern: {
          scoreId: 'weather-score',
        },
      },
      streamState: {
        status: 'ok',
        metadata: {
          provider: 'open-meteo',
          mode: 'live',
          condition: 'overcast',
        },
      },
    });
    expect(firstFrame.frame?.visualParameters.signature).toBe(
      repeatedFrame.frame?.visualParameters.signature,
    );
    expect(firstFrame.frame?.audioParameters.signature).toBe(
      repeatedFrame.frame?.audioParameters.signature,
    );
    expect(firstFrame.frame?.hapticPattern.signature).toBe(
      repeatedFrame.frame?.hapticPattern.signature,
    );
  });

  it('marks old live observations as stale while preserving the score path', async () => {
    const frame = await readLiveWeatherFrame({
      fetchWeather: createOpenMeteoFetch(),
      now: new Date('2026-06-14T23:00:00.000Z'),
      online: true,
    });

    expect(frame).toMatchObject({
      status: 'stale',
      message: 'Live weather is stale; outputs are using the latest received frame.',
      frame: {
        statusLabel: 'overcast stale live weather',
        streamStatus: 'stale',
        liveStatus: 'stale',
        visualParameters: {
          scoreId: 'weather-score',
          condition: 'overcast',
        },
      },
      streamState: {
        status: 'stale',
      },
    });
  });

  it('returns an offline state without touching replay-safe outputs', async () => {
    const fetchWeather = vi.fn();

    const frame = await readLiveWeatherFrame({
      fetchWeather,
      online: false,
    });

    expect(frame).toEqual({
      status: 'offline',
      message: 'Live weather is offline; replay remains available.',
    });
    expect(fetchWeather).not.toHaveBeenCalled();
  });

  it('surfaces adapter errors without producing a live frame', async () => {
    const frame = await readLiveWeatherFrame({
      fetchWeather: () =>
        Promise.resolve({
          ok: false,
          status: 503,
          json: () => Promise.resolve({}),
        }),
      now: new Date('2026-06-14T21:05:00.000Z'),
      online: true,
    });

    expect(frame).toMatchObject({
      status: 'error',
      message: 'Live weather adapter error: Weather provider request failed with HTTP 503.',
      streamState: {
        status: 'error',
        metadata: {
          mode: 'live',
          error: {
            code: 'fetch-failed',
          },
        },
      },
    });
    expect(frame.frame).toBeUndefined();
  });
});

function createOpenMeteoFetch() {
  return () =>
    Promise.resolve({
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
}
