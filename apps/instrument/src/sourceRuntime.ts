import {
  BROWSER_SENSOR_STREAM_SOURCE_ID,
  WEATHER_STREAM_SOURCE_ID,
  createRegisteredStreamAdapter,
  createBrowserSensorFixturePayload,
  recordedOpenMeteoLondonCurrentV1,
  streamSourceRegistry,
  type BrowserSensorRead,
  type WeatherFetch,
  type WeatherLocation,
} from '@world-instrument/adapters';
import {
  supportsStreamSourceMode,
  type NormalizedStreamState,
  type StreamSourceDefinition,
  type StreamSourceMode,
} from '@world-instrument/core';
import { sensorScoreV1, weatherScoreV1 } from '@world-instrument/scores';

import {
  FIXTURE_BROWSER_SENSOR_SEED,
  LIVE_BROWSER_SENSOR_REFRESH_INTERVAL_MS,
  LIVE_BROWSER_SENSOR_SEED,
  LIVE_BROWSER_SENSOR_STALE_AFTER_MS,
  readBrowserSensor,
} from './browserSensor.ts';
import {
  DEFAULT_LIVE_WEATHER_LOCATION,
  LIVE_WEATHER_SEED,
  LIVE_WEATHER_REFRESH_INTERVAL_MS,
  OPEN_METEO_FORECAST_ENDPOINT,
  readLiveWeatherFrame,
} from './liveWeather.ts';
import {
  evaluateWeatherInstrumentFrame,
  type WeatherInstrumentState,
} from './weatherInstrument.ts';

export { FIXTURE_BROWSER_SENSOR_SEED, LIVE_BROWSER_SENSOR_SEED } from './browserSensor.ts';

export const DEFAULT_INSTRUMENT_SOURCE_ID = WEATHER_STREAM_SOURCE_ID;
export const DEFAULT_INSTRUMENT_SOURCE_MODE = 'live' as const satisfies StreamSourceMode;
export const FIXTURE_WEATHER_SEED = 'world-instrument-fixture-weather-v1';

export type SourceReadStatus = 'degraded' | 'error' | 'offline' | 'ready' | 'stale' | 'unavailable';

export interface SourceInstrumentFrameState extends WeatherInstrumentState {
  readonly observedAt: string;
  readonly receivedAt: string;
  readonly streamStatus: NormalizedStreamState['status'];
  readonly streamSequence: number;
  readonly sourceMode: Exclude<StreamSourceMode, 'replay'>;
  readonly seed: string;
}

export interface SourceReadState {
  readonly sourceId: string;
  readonly sourceName: string;
  readonly sourceMode: Exclude<StreamSourceMode, 'replay'>;
  readonly status: SourceReadStatus;
  readonly message: string;
  readonly seed?: string;
  readonly frame?: SourceInstrumentFrameState;
  readonly streamState?: NormalizedStreamState;
}

export interface ReadSourceFrameOptions {
  readonly sourceId: string;
  readonly sourceMode: Exclude<StreamSourceMode, 'replay'>;
  readonly endpointUrl?: string;
  readonly fetchWeather?: WeatherFetch;
  readonly readSensor?: BrowserSensorRead;
  readonly location?: WeatherLocation;
  readonly now?: Date;
  readonly online?: boolean;
  readonly previousSequence?: number;
  readonly signal?: AbortSignal;
  readonly staleAfterMs?: number;
}

export const instrumentSourceDefinitions = streamSourceRegistry.list();

export function sourceDefinition(sourceId: string): StreamSourceDefinition {
  return streamSourceRegistry.require(sourceId);
}

export function sourceSupportsMode(sourceId: string, mode: StreamSourceMode): boolean {
  return streamSourceRegistry.supports(sourceId, mode);
}

export function sourceHasCompatibleScore(sourceId: string): boolean {
  return [weatherScoreV1.metadata, sensorScoreV1.metadata].some((score) =>
    streamSourceRegistry
      .compatibleSourcesForScore(score)
      .some((definition) => definition.id === sourceId),
  );
}

export function selectableModeForSource(
  sourceId: string,
  requestedMode: StreamSourceMode,
): StreamSourceMode {
  if (sourceSupportsMode(sourceId, requestedMode)) {
    return requestedMode;
  }

  return sourceDefinition(sourceId).defaultMode;
}

export function sourceCapabilitySummary(definition: StreamSourceDefinition): string {
  const supportedModes = definition.capabilities.map((capability) => capability.mode).join(', ');
  const scoreSummary = sourceHasCompatibleScore(definition.id)
    ? 'score-ready'
    : 'score unavailable';

  return `${supportedModes}; ${scoreSummary}`;
}

export function liveRefreshIntervalForSource(sourceId: string): number {
  return sourceId === BROWSER_SENSOR_STREAM_SOURCE_ID
    ? LIVE_BROWSER_SENSOR_REFRESH_INTERVAL_MS
    : LIVE_WEATHER_REFRESH_INTERVAL_MS;
}

export async function readSourceFrame(options: ReadSourceFrameOptions): Promise<SourceReadState> {
  const definition = sourceDefinition(options.sourceId);

  if (!supportsStreamSourceMode(definition, options.sourceMode)) {
    return unavailableState(
      definition,
      options.sourceMode,
      `${definition.displayName} does not support ${options.sourceMode} input yet.`,
    );
  }

  if (options.sourceMode === 'live') {
    return readLiveSourceFrame(definition, options);
  }

  return readFixtureSourceFrame(definition, options);
}

async function readLiveSourceFrame(
  definition: StreamSourceDefinition,
  options: ReadSourceFrameOptions,
): Promise<SourceReadState> {
  if (definition.id === BROWSER_SENSOR_STREAM_SOURCE_ID) {
    return readLiveBrowserSensorFrame(definition, options);
  }

  if (definition.id !== WEATHER_STREAM_SOURCE_ID) {
    return unavailableState(
      definition,
      'live',
      `${definition.displayName} is registered, but no live adapter is available in the app yet.`,
    );
  }

  const liveState = await readLiveWeatherFrame({
    endpointUrl: options.endpointUrl ?? OPEN_METEO_FORECAST_ENDPOINT,
    ...(options.fetchWeather === undefined ? {} : { fetchWeather: options.fetchWeather }),
    location: options.location ?? DEFAULT_LIVE_WEATHER_LOCATION,
    ...(options.now === undefined ? {} : { now: options.now }),
    ...(options.online === undefined ? {} : { online: options.online }),
    ...(options.previousSequence === undefined
      ? {}
      : { previousSequence: options.previousSequence }),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
    ...(options.staleAfterMs === undefined ? {} : { staleAfterMs: options.staleAfterMs }),
  });

  return {
    sourceId: definition.id,
    sourceName: definition.displayName,
    sourceMode: 'live',
    status: liveState.status,
    message: liveState.message,
    seed: LIVE_WEATHER_SEED,
    ...(liveState.frame === undefined
      ? {}
      : {
          frame: {
            ...liveState.frame,
            sourceMode: 'live',
            seed: LIVE_WEATHER_SEED,
          },
        }),
    ...(liveState.streamState === undefined ? {} : { streamState: liveState.streamState }),
  };
}

async function readLiveBrowserSensorFrame(
  definition: StreamSourceDefinition,
  options: ReadSourceFrameOptions,
): Promise<SourceReadState> {
  const now = options.now ?? new Date();
  const adapter = createRegisteredStreamAdapter(BROWSER_SENSOR_STREAM_SOURCE_ID, {
    mode: 'live',
    readSensor: options.readSensor ?? readBrowserSensor,
    receivedAt: now.toISOString(),
  });
  const result = await adapter.read({
    ...(options.previousSequence === undefined ? {} : { afterSequence: options.previousSequence }),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  });
  const observedAtMs = Date.parse(result.state.observedAt);

  if (Number.isNaN(observedAtMs)) {
    return {
      sourceId: definition.id,
      sourceName: definition.displayName,
      sourceMode: 'live',
      status: 'error',
      message: 'Browser sensor input returned an invalid observation time.',
      streamState: result.state,
    };
  }

  const staleAfterMs = options.staleAfterMs ?? LIVE_BROWSER_SENSOR_STALE_AFTER_MS;
  const isStale = now.valueOf() - observedAtMs > staleAfterMs;
  const streamState =
    isStale || result.state.status === 'stale'
      ? {
          ...result.state,
          status: 'stale' as const,
        }
      : result.state;

  if (streamState.status === 'error') {
    return unavailableState(
      definition,
      'live',
      'Browser sensors are unavailable in this environment; replay remains available.',
      streamState,
    );
  }

  const frame = evaluateSourceFrame(streamState, 'live', LIVE_BROWSER_SENSOR_SEED);
  const status = isStale ? 'stale' : streamState.status === 'degraded' ? 'degraded' : 'ready';

  return {
    sourceId: definition.id,
    sourceName: definition.displayName,
    sourceMode: 'live',
    status,
    message: browserSensorMessage(status, streamState),
    seed: LIVE_BROWSER_SENSOR_SEED,
    frame,
    streamState,
  };
}

async function readFixtureSourceFrame(
  definition: StreamSourceDefinition,
  options: ReadSourceFrameOptions,
): Promise<SourceReadState> {
  if (definition.id === WEATHER_STREAM_SOURCE_ID) {
    const adapter = createRegisteredStreamAdapter(WEATHER_STREAM_SOURCE_ID, {
      mode: 'fixture',
      fixture: recordedOpenMeteoLondonCurrentV1,
    });
    const result = await adapter.read({
      ...(options.previousSequence === undefined
        ? {}
        : { afterSequence: options.previousSequence }),
    });
    const frame = evaluateSourceFrame(result.state, 'fixture', FIXTURE_WEATHER_SEED);

    return {
      sourceId: definition.id,
      sourceName: definition.displayName,
      sourceMode: 'fixture',
      status: 'ready',
      message: `${definition.displayName} fixture is driving the instrument.`,
      seed: FIXTURE_WEATHER_SEED,
      frame,
      streamState: result.state,
    };
  }

  if (definition.id === BROWSER_SENSOR_STREAM_SOURCE_ID) {
    const adapter = createRegisteredStreamAdapter(BROWSER_SENSOR_STREAM_SOURCE_ID, {
      mode: 'fixture',
      fixture: createBrowserSensorFixturePayload(),
    });
    const result = await adapter.read({
      ...(options.previousSequence === undefined
        ? {}
        : { afterSequence: options.previousSequence }),
    });

    const frame = evaluateSourceFrame(result.state, 'fixture', FIXTURE_BROWSER_SENSOR_SEED);

    return {
      sourceId: definition.id,
      sourceName: definition.displayName,
      sourceMode: 'fixture',
      status: result.state.status === 'degraded' ? 'degraded' : 'ready',
      message: `${definition.displayName} fixture is driving the instrument.`,
      seed: FIXTURE_BROWSER_SENSOR_SEED,
      frame,
      streamState: result.state,
    };
  }

  return unavailableState(
    definition,
    'fixture',
    `${definition.displayName} is registered, but no fixture reader is available in the app yet.`,
  );
}

function evaluateSourceFrame(
  streamState: NormalizedStreamState,
  sourceMode: Exclude<StreamSourceMode, 'replay'>,
  seed: string,
): SourceInstrumentFrameState {
  const instrumentFrame = evaluateWeatherInstrumentFrame({
    frameIndex: streamState.sequence,
    elapsedMs: 0,
    capturedAt: streamState.observedAt,
    streams: [streamState],
    seed,
    sourceLabel: streamState.source.label ?? streamState.source.id,
  });

  return {
    ...instrumentFrame,
    observedAt: streamState.observedAt,
    receivedAt: streamState.receivedAt,
    streamStatus: streamState.status,
    streamSequence: streamState.sequence,
    sourceMode,
    seed,
    statusLabel: `${instrumentFrame.visualParameters.condition} ${sourceMode} ${streamState.source.kind}`,
  };
}

function unavailableState(
  definition: StreamSourceDefinition,
  sourceMode: Exclude<StreamSourceMode, 'replay'>,
  message: string,
  streamState?: NormalizedStreamState,
): SourceReadState {
  return {
    sourceId: definition.id,
    sourceName: definition.displayName,
    sourceMode,
    status: 'unavailable',
    message,
    ...(streamState === undefined ? {} : { streamState }),
  };
}

function browserSensorMessage(
  status: SourceReadStatus,
  streamState: NormalizedStreamState,
): string {
  const capability = streamState.metadata?.capability;
  const capabilitySummary =
    isCapabilityMetadata(capability) &&
    (capability.motion === 'prompt' || capability.orientation === 'prompt')
      ? ' Device sensors can be activated; pointer input is already available.'
      : '';

  if (status === 'stale') {
    return 'Browser sensor input is stale; outputs are using the latest interaction frame.';
  }

  if (status === 'degraded') {
    return `Browser interaction is driving the instrument through pointer fallback.${capabilitySummary}`;
  }

  return 'Browser sensors are driving the instrument.';
}

function isCapabilityMetadata(
  value: unknown,
): value is { readonly motion: string; readonly orientation: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'motion' in value &&
    'orientation' in value &&
    typeof value.motion === 'string' &&
    typeof value.orientation === 'string'
  );
}
