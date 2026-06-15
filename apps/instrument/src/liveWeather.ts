import {
  OPEN_METEO_FORECAST_ENDPOINT,
  WeatherAdapter,
  type WeatherAdapterFailurePayload,
  type WeatherFetch,
  type WeatherLocation,
} from '@world-instrument/adapters';
import type { NormalizedStreamState, StreamAdapterResult } from '@world-instrument/core';

import {
  evaluateWeatherInstrumentPipeline,
  type WeatherInstrumentPipelineState,
} from './weatherPipeline.ts';

export const LIVE_WEATHER_LOCATION: WeatherLocation = {
  id: 'london-uk',
  label: 'London, UK',
  latitude: 51.5072,
  longitude: -0.1276,
  timezone: 'GMT',
};

export const LIVE_WEATHER_SCORE_SEED = 'world-instrument:weather:live:london-uk:v1';
export const LIVE_WEATHER_STALE_AFTER_MS = 90 * 60 * 1000;

export type LiveWeatherReadStatus = 'ready' | 'stale' | 'error';

export interface LiveWeatherInstrumentFrameState extends WeatherInstrumentPipelineState {
  readonly mode: 'live';
  readonly framePosition: 0;
  readonly frameCount: 1;
  readonly elapsedMs: 0;
  readonly durationMs: 0;
  readonly statusLabel: string;
  readonly observedAt: string;
  readonly receivedAt: string;
  readonly streamStatus: NormalizedStreamState['status'];
}

export interface LiveWeatherReadResult {
  readonly status: LiveWeatherReadStatus;
  readonly state: NormalizedStreamState;
  readonly frame?: LiveWeatherInstrumentFrameState;
  readonly errorMessage?: string;
}

export interface ReadLiveWeatherOptions {
  readonly afterSequence?: number;
  readonly endpointUrl?: string;
  readonly fetchWeather?: WeatherFetch;
  readonly receivedAt?: string;
  readonly nowMs?: number;
}

export async function readLiveWeatherInstrumentFrame(
  options: ReadLiveWeatherOptions = {},
): Promise<LiveWeatherReadResult> {
  const adapter = new WeatherAdapter({
    mode: 'live',
    endpointUrl: options.endpointUrl ?? OPEN_METEO_FORECAST_ENDPOINT,
    location: LIVE_WEATHER_LOCATION,
    ...(options.fetchWeather === undefined ? {} : { fetchWeather: options.fetchWeather }),
    ...(options.receivedAt === undefined ? {} : { receivedAt: options.receivedAt }),
  });
  const result = await adapter.read(
    options.afterSequence === undefined ? {} : { afterSequence: options.afterSequence },
  );

  if (result.state.status === 'error') {
    return {
      status: 'error',
      state: result.state,
      errorMessage: adapterErrorMessage(result),
    };
  }

  const stale = isLiveWeatherStateStale(result.state, options.nowMs ?? Date.now());

  return {
    status: stale ? 'stale' : 'ready',
    state: result.state,
    frame: evaluateLiveWeatherFrame(result.state, stale),
  };
}

export function evaluateLiveWeatherFrame(
  state: NormalizedStreamState,
  stale = false,
): LiveWeatherInstrumentFrameState {
  const pipeline = evaluateWeatherInstrumentPipeline({
    frameIndex: state.sequence,
    elapsedMs: 0,
    renderedAt: state.observedAt,
    streams: [state],
    seed: LIVE_WEATHER_SCORE_SEED,
  });

  return {
    mode: 'live',
    framePosition: 0,
    frameCount: 1,
    elapsedMs: 0,
    durationMs: 0,
    statusLabel: liveStatusLabel(pipeline.visualParameters.condition, state.status, stale),
    observedAt: state.observedAt,
    receivedAt: state.receivedAt,
    streamStatus: state.status,
    ...pipeline,
  };
}

export function isLiveWeatherStateStale(state: NormalizedStreamState, nowMs: number): boolean {
  const observedAtMs = Date.parse(state.observedAt);

  if (!Number.isFinite(observedAtMs)) {
    return true;
  }

  return nowMs - observedAtMs > LIVE_WEATHER_STALE_AFTER_MS;
}

function liveStatusLabel(
  condition: string,
  streamStatus: NormalizedStreamState['status'],
  stale: boolean,
): string {
  if (stale || streamStatus === 'stale') {
    return `${condition} live weather stale`;
  }

  if (streamStatus === 'degraded') {
    return `${condition} live weather degraded`;
  }

  return `${condition} live weather current`;
}

function adapterErrorMessage(result: StreamAdapterResult<unknown>): string {
  const raw = result.raw;

  if (isWeatherAdapterFailure(raw)) {
    return raw.error.message;
  }

  return 'Live weather adapter failed.';
}

function isWeatherAdapterFailure(value: unknown): value is WeatherAdapterFailurePayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ok' in value &&
    value.ok === false &&
    'error' in value
  );
}
