import { describe, expect, it } from 'vitest';

import { evaluateLiveWeatherFrame, readLiveWeatherInstrumentFrame } from '../src/liveWeather.ts';

describe('live weather instrument path', () => {
  it('fetches no-credential Open-Meteo weather and routes it through the shared pipeline', async () => {
    let requestedUrl: string | undefined;

    const result = await readLiveWeatherInstrumentFrame({
      receivedAt: '2026-06-15T03:50:00.000Z',
      nowMs: Date.parse('2026-06-15T04:00:00.000Z'),
      fetchWeather: (url) => {
        requestedUrl = url;

        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              timezone: 'GMT',
              current: {
                time: '2026-06-15T03:45',
                temperature_2m: 20.2,
                apparent_temperature: 19.8,
                relative_humidity_2m: 54,
                precipitation: 0,
                rain: 0,
                weather_code: 0,
                cloud_cover: 12,
                surface_pressure: 1018.6,
                wind_speed_10m: 4.4,
                wind_direction_10m: 215,
              },
            }),
        });
      },
    });

    expect(requestedUrl).toBeDefined();
    expect(new URL(requestedUrl ?? '').searchParams.get('apikey')).toBeNull();
    expect(result.status).toBe('ready');
    expect(result.state).toMatchObject({
      status: 'ok',
      observedAt: '2026-06-15T03:45:00.000Z',
      metadata: {
        provider: 'open-meteo',
        mode: 'live',
        condition: 'clear',
      },
    });
    expect(result.frame).toMatchObject({
      mode: 'live',
      framePosition: 0,
      frameCount: 1,
      sourceLabel: 'London, UK weather',
      statusLabel: 'clear live weather current',
      visualParameters: {
        condition: 'clear',
        scoreId: 'weather-score',
      },
      audioParameters: {
        enabled: true,
      },
    });

    const repeatedFrame = evaluateLiveWeatherFrame(result.state);

    expect(repeatedFrame.visualParameters).toEqual(result.frame?.visualParameters);
    expect(repeatedFrame.audioParameters).toEqual(result.frame?.audioParameters);
    expect(repeatedFrame.hapticPattern).toEqual(result.frame?.hapticPattern);
  });

  it('marks old live weather frames as stale without changing the score routing', async () => {
    const result = await readLiveWeatherInstrumentFrame({
      receivedAt: '2026-06-15T03:50:00.000Z',
      nowMs: Date.parse('2026-06-15T06:00:00.000Z'),
      fetchWeather: () =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              timezone: 'GMT',
              current: {
                time: '2026-06-15T03:45',
                temperature_2m: 20.2,
                weather_code: 0,
              },
            }),
        }),
    });

    expect(result.status).toBe('stale');
    expect(result.frame?.statusLabel).toBe('clear live weather stale');
    expect(result.frame?.visualParameters.condition).toBe('clear');
  });

  it('reports adapter errors without producing a live instrument frame', async () => {
    const result = await readLiveWeatherInstrumentFrame({
      receivedAt: '2026-06-15T03:50:00.000Z',
      fetchWeather: () =>
        Promise.resolve({
          ok: false,
          status: 503,
          json: () => Promise.resolve({}),
        }),
    });

    expect(result).toMatchObject({
      status: 'error',
      errorMessage: 'Weather provider request failed with HTTP 503.',
      state: {
        status: 'error',
        metadata: {
          mode: 'live',
          error: {
            code: 'fetch-failed',
          },
        },
      },
    });
    expect(result.frame).toBeUndefined();
  });
});
