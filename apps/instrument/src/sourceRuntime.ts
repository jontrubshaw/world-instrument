import {
  BROWSER_SENSOR_STREAM_SOURCE_ID,
  WEATHER_STREAM_SOURCE_ID,
  createRegisteredStreamAdapter,
  createDeterministicBrowserSensorSnapshot,
  recordedOpenMeteoLondonCurrentV1,
  streamSourceRegistry,
  type RecordedBrowserSensorPayload,
  type WeatherFetch,
  type WeatherLocation,
} from '@world-instrument/adapters';
import {
  supportsStreamSourceMode,
  type NormalizedStreamState,
  type StreamSourceDefinition,
  type StreamSourceMode,
} from '@world-instrument/core';

import {
  DEFAULT_LIVE_WEATHER_LOCATION,
  LIVE_WEATHER_SEED,
  OPEN_METEO_FORECAST_ENDPOINT,
  readLiveWeatherFrame,
} from './liveWeather.ts';
import {
  evaluateInstrumentFrame,
  instrumentScoreMetadata,
  scoreMetadataForId,
  type WeatherInstrumentState,
} from './weatherInstrument.ts';

export const DEFAULT_INSTRUMENT_SOURCE_ID = WEATHER_STREAM_SOURCE_ID;
export const DEFAULT_INSTRUMENT_SOURCE_MODE = 'live' as const satisfies StreamSourceMode;
export const FIXTURE_WEATHER_SEED = 'world-instrument-fixture-weather-v1';
export const FIXTURE_BROWSER_SENSOR_SEED = 'world-instrument-fixture-browser-sensor-v1';
export const LIVE_BROWSER_SENSOR_SEED = 'world-instrument-live-browser-sensor-v1';
export const BROWSER_SENSOR_STALE_AFTER_MS = 3_000;

export type SourceReadStatus = 'error' | 'offline' | 'ready' | 'stale' | 'unavailable';

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
  readonly browserSensorSnapshot?: RecordedBrowserSensorPayload;
  readonly fetchWeather?: WeatherFetch;
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
  return (
    streamSourceRegistry.compatibleScoresForSource(sourceId, instrumentScoreMetadata).length > 0
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

export function browserSensorStaleRefreshDelayMs(
  observedAt: string,
  now = new Date(),
  staleAfterMs = BROWSER_SENSOR_STALE_AFTER_MS,
): number | undefined {
  const observedAtMs = Date.parse(observedAt);

  if (Number.isNaN(observedAtMs)) {
    return undefined;
  }

  return Math.max(observedAtMs + staleAfterMs - now.getTime(), 0);
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
    return readBrowserSensorSourceFrame(definition, 'live', options);
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
    const frame = evaluateSourceWeatherFrame(
      definition,
      result.state,
      'fixture',
      FIXTURE_WEATHER_SEED,
    );

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
    return readBrowserSensorSourceFrame(definition, 'fixture', options);
  }

  return unavailableState(
    definition,
    'fixture',
    `${definition.displayName} is registered, but no fixture reader is available in the app yet.`,
  );
}

async function readBrowserSensorSourceFrame(
  definition: StreamSourceDefinition,
  sourceMode: Exclude<StreamSourceMode, 'replay'>,
  options: ReadSourceFrameOptions,
): Promise<SourceReadState> {
  const now = options.now ?? new Date();
  const seed = sourceMode === 'live' ? LIVE_BROWSER_SENSOR_SEED : FIXTURE_BROWSER_SENSOR_SEED;
  const snapshot =
    sourceMode === 'live'
      ? (options.browserSensorSnapshot ?? createBrowserSensorWaitingSnapshot(now.toISOString()))
      : createDeterministicBrowserSensorSnapshot({
          frameIndex: options.previousSequence === undefined ? 0 : options.previousSequence + 1,
        });
  const adapter =
    sourceMode === 'live'
      ? createRegisteredStreamAdapter(BROWSER_SENSOR_STREAM_SOURCE_ID, {
          mode: 'live',
          snapshot,
          now: now.toISOString(),
          staleAfterMs: options.staleAfterMs ?? BROWSER_SENSOR_STALE_AFTER_MS,
        })
      : createRegisteredStreamAdapter(BROWSER_SENSOR_STREAM_SOURCE_ID, {
          mode: 'fixture',
          fixture: snapshot,
        });
  const result = await adapter.read({
    ...(options.previousSequence === undefined ? {} : { afterSequence: options.previousSequence }),
  });
  const frame = evaluateSourceWeatherFrame(definition, result.state, sourceMode, seed);
  const status = result.state.status === 'stale' ? 'stale' : 'ready';

  return {
    sourceId: definition.id,
    sourceName: definition.displayName,
    sourceMode,
    status,
    message: browserSensorMessage(result.state, definition.displayName, sourceMode),
    seed,
    frame,
    streamState: result.state,
  };
}

function evaluateSourceWeatherFrame(
  definition: StreamSourceDefinition,
  streamState: NormalizedStreamState,
  sourceMode: Exclude<StreamSourceMode, 'replay'>,
  seed: string,
): SourceInstrumentFrameState {
  const scoreId = definition.defaultScoreId;
  const score = scoreId === undefined ? undefined : scoreMetadataForId(scoreId);
  const instrumentFrame = evaluateInstrumentFrame({
    frameIndex: streamState.sequence,
    elapsedMs: 0,
    capturedAt: streamState.observedAt,
    streams: [streamState],
    seed,
    ...(score === undefined ? {} : { scoreId: score.scoreId, scoreVersion: score.scoreVersion }),
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

function browserSensorMessage(
  streamState: NormalizedStreamState,
  sourceName: string,
  sourceMode: Exclude<StreamSourceMode, 'replay'>,
): string {
  if (streamState.status === 'stale') {
    return `${sourceName} input is stale; move the pointer or enable device sensors to refresh the instrument.`;
  }

  const activeInputs = Array.isArray(streamState.metadata?.activeInputs)
    ? streamState.metadata.activeInputs
    : [];

  if (streamState.status === 'degraded') {
    if (activeInputs.includes('pointer')) {
      return `${sourceName} pointer fallback is driving the instrument; motion/orientation sensors are unavailable or waiting for permission.`;
    }

    return `${sourceName} is waiting for local interaction; move the pointer to drive the instrument.`;
  }

  return `${sourceName} ${sourceMode} input is driving the instrument.`;
}

function createBrowserSensorWaitingSnapshot(observedAt: string): RecordedBrowserSensorPayload {
  return {
    provider: 'browser-sensor',
    observedAt,
    device: {
      id: 'local-browser',
      label: 'Local browser',
    },
    capabilities: {
      pointer: 'available',
      deviceMotion: 'unknown',
      deviceOrientation: 'unknown',
      permission: 'not-requested',
      fallback: 'pointer',
    },
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
