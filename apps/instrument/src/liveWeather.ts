import {
  WeatherAdapter,
  type WeatherFetch,
  type WeatherLocation,
} from '@world-instrument/adapters';
import type { NormalizedStreamState } from '@world-instrument/core';

import {
  evaluateWeatherInstrumentFrame,
  type WeatherInstrumentState,
} from './weatherInstrument.ts';

export const LIVE_WEATHER_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
export const LIVE_WEATHER_STALE_AFTER_MS = 90 * 60 * 1000;
export const LIVE_WEATHER_SEED = 'world-instrument-live-weather-v1';
export const OPEN_METEO_FORECAST_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

export const DEFAULT_LIVE_WEATHER_LOCATION: WeatherLocation = {
  id: 'london-uk',
  label: 'London, UK',
  latitude: 51.5072,
  longitude: -0.1276,
  timezone: 'Europe/London',
};

export type LiveWeatherReadStatus = 'error' | 'offline' | 'ready' | 'stale';

export interface LiveWeatherInstrumentFrameState extends WeatherInstrumentState {
  readonly observedAt: string;
  readonly receivedAt: string;
  readonly streamStatus: NormalizedStreamState['status'];
  readonly streamSequence: number;
  readonly liveStatus: Extract<LiveWeatherReadStatus, 'ready' | 'stale'>;
}

export interface LiveWeatherReadState {
  readonly status: LiveWeatherReadStatus;
  readonly message: string;
  readonly frame?: LiveWeatherInstrumentFrameState;
  readonly streamState?: NormalizedStreamState;
}

export interface ReadLiveWeatherFrameOptions {
  readonly endpointUrl?: string;
  readonly fetchWeather?: WeatherFetch;
  readonly location?: WeatherLocation;
  readonly now?: Date;
  readonly online?: boolean;
  readonly previousSequence?: number;
  readonly signal?: AbortSignal;
  readonly staleAfterMs?: number;
}

export async function readLiveWeatherFrame(
  options: ReadLiveWeatherFrameOptions = {},
): Promise<LiveWeatherReadState> {
  const online = options.online ?? browserIsOnline();

  if (!online) {
    return {
      status: 'offline',
      message: 'Live weather is offline; replay remains available.',
    };
  }

  const now = options.now ?? new Date();
  const adapter = new WeatherAdapter({
    mode: 'live',
    endpointUrl: options.endpointUrl ?? OPEN_METEO_FORECAST_ENDPOINT,
    location: options.location ?? DEFAULT_LIVE_WEATHER_LOCATION,
    receivedAt: now.toISOString(),
    ...(options.fetchWeather === undefined ? {} : { fetchWeather: options.fetchWeather }),
  });
  const result = await adapter.read({
    ...(options.previousSequence === undefined ? {} : { afterSequence: options.previousSequence }),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  });

  if (result.state.status === 'error') {
    return {
      status: 'error',
      message: adapterErrorMessage(result.raw),
      streamState: result.state,
    };
  }

  const observedAtMs = Date.parse(result.state.observedAt);

  if (Number.isNaN(observedAtMs)) {
    return {
      status: 'error',
      message: 'Live weather returned an invalid observation time.',
      streamState: result.state,
    };
  }

  const staleAfterMs = options.staleAfterMs ?? LIVE_WEATHER_STALE_AFTER_MS;
  const liveStatus = now.valueOf() - observedAtMs > staleAfterMs ? 'stale' : 'ready';
  const streamState =
    liveStatus === 'stale'
      ? {
          ...result.state,
          status: 'stale' as const,
        }
      : result.state;
  const frame = evaluateLiveWeatherInstrumentFrame(streamState, liveStatus);

  return {
    status: liveStatus,
    message:
      liveStatus === 'stale'
        ? 'Live weather is stale; outputs are using the latest received frame.'
        : 'Live weather is driving the instrument.',
    frame,
    streamState,
  };
}

function evaluateLiveWeatherInstrumentFrame(
  streamState: NormalizedStreamState,
  liveStatus: Extract<LiveWeatherReadStatus, 'ready' | 'stale'>,
): LiveWeatherInstrumentFrameState {
  const instrumentFrame = evaluateWeatherInstrumentFrame({
    frameIndex: streamState.sequence,
    elapsedMs: 0,
    capturedAt: streamState.observedAt,
    streams: [streamState],
    seed: LIVE_WEATHER_SEED,
    sourceLabel: streamState.source.label ?? streamState.source.id,
  });

  return {
    ...instrumentFrame,
    observedAt: streamState.observedAt,
    receivedAt: streamState.receivedAt,
    streamStatus: streamState.status,
    streamSequence: streamState.sequence,
    liveStatus,
    statusLabel: `${instrumentFrame.visualParameters.condition} ${liveStatus} live weather`,
  };
}

function browserIsOnline(): boolean {
  if (typeof navigator === 'undefined') {
    return true;
  }

  return navigator.onLine;
}

function adapterErrorMessage(raw: unknown): string {
  if (isAdapterFailure(raw)) {
    return `Live weather adapter error: ${raw.error.message}`;
  }

  return 'Live weather adapter error; replay remains available.';
}

function isAdapterFailure(
  value: unknown,
): value is { readonly error: { readonly message: string } } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof value.error === 'object' &&
    value.error !== null &&
    'message' in value.error &&
    typeof value.error.message === 'string'
  );
}
