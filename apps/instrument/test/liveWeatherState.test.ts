import { describe, expect, it } from 'vitest';

import { readLiveWeatherFrame } from '../src/liveWeather.ts';
import { mergeLiveWeatherUiState, type LiveWeatherUiState } from '../src/liveWeatherState.ts';

describe('live weather UI state', () => {
  it('keeps successful frame output paired with its scored stream after an error-only refresh', async () => {
    const readyState = await readLiveWeatherFrame({
      fetchWeather: createOpenMeteoFetch(),
      now: new Date('2026-06-14T21:05:00.000Z'),
      online: true,
    });
    const errorState = await readLiveWeatherFrame({
      fetchWeather: () =>
        Promise.resolve({
          ok: false,
          status: 503,
          json: () => Promise.resolve({}),
        }),
      now: new Date('2026-06-14T21:15:00.000Z'),
      online: true,
      previousSequence: readyState.frame?.streamSequence,
    });
    const mergedState = mergeLiveWeatherUiState(asUiState(readyState), errorState);

    expect(errorState).toMatchObject({
      status: 'error',
      streamState: {
        status: 'error',
        sequence: 1,
      },
    });
    expect(mergedState).toMatchObject({
      status: 'error',
      message: 'Live weather adapter error: Weather provider request failed with HTTP 503.',
      frame: {
        frameIndex: 0,
        streamSequence: 0,
      },
      streamState: {
        status: 'ok',
        sequence: 0,
      },
    });
    expect(mergedState.frame).toBe(readyState.frame);
    expect(mergedState.streamState).toBe(readyState.streamState);
  });

  it('keeps error stream diagnostics when no scored frame is available yet', async () => {
    const errorState = await readLiveWeatherFrame({
      fetchWeather: () =>
        Promise.resolve({
          ok: false,
          status: 503,
          json: () => Promise.resolve({}),
        }),
      now: new Date('2026-06-14T21:15:00.000Z'),
      online: true,
    });
    const mergedState = mergeLiveWeatherUiState(
      {
        status: 'loading',
        message: 'Loading current weather...',
      },
      errorState,
    );

    expect(mergedState).toMatchObject({
      status: 'error',
      streamState: {
        status: 'error',
        sequence: 0,
      },
    });
    expect(mergedState.frame).toBeUndefined();
  });
});

function asUiState(state: Awaited<ReturnType<typeof readLiveWeatherFrame>>): LiveWeatherUiState {
  return {
    status: state.status,
    message: state.message,
    ...(state.frame === undefined ? {} : { frame: state.frame }),
    ...(state.streamState === undefined ? {} : { streamState: state.streamState }),
  };
}

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
