import {
  MOCK_SENSOR_STREAM_SOURCE_ID,
  WEATHER_STREAM_SOURCE_ID,
  createRegisteredStreamAdapter,
  recordedOpenMeteoLondonCurrentV1,
  streamSourceRegistry,
  type RecordedMockSensorPayload,
  type WeatherFetch,
  type WeatherLocation,
} from '@world-instrument/adapters';
import {
  supportsStreamSourceMode,
  type NormalizedStreamState,
  type StreamSourceDefinition,
  type StreamSourceMode,
} from '@world-instrument/core';
import { weatherScoreV1 } from '@world-instrument/scores';

import {
  DEFAULT_LIVE_WEATHER_LOCATION,
  LIVE_WEATHER_SEED,
  OPEN_METEO_FORECAST_ENDPOINT,
  readLiveWeatherFrame,
} from './liveWeather.ts';
import {
  evaluateWeatherInstrumentFrame,
  type WeatherInstrumentState,
} from './weatherInstrument.ts';

export const DEFAULT_INSTRUMENT_SOURCE_ID = WEATHER_STREAM_SOURCE_ID;
export const DEFAULT_INSTRUMENT_SOURCE_MODE = 'live' as const satisfies StreamSourceMode;
export const FIXTURE_WEATHER_SEED = 'world-instrument-fixture-weather-v1';

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
  return streamSourceRegistry
    .compatibleSourcesForScore(weatherScoreV1.metadata)
    .some((definition) => definition.id === sourceId);
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
    const frame = evaluateSourceWeatherFrame(result.state, 'fixture', FIXTURE_WEATHER_SEED);

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

  if (definition.id === MOCK_SENSOR_STREAM_SOURCE_ID) {
    const adapter = createRegisteredStreamAdapter(MOCK_SENSOR_STREAM_SOURCE_ID, {
      mode: 'fixture',
      fixture: MOCK_SENSOR_FIXTURE,
    });
    const result = await adapter.read({
      ...(options.previousSequence === undefined
        ? {}
        : { afterSequence: options.previousSequence }),
    });

    return unavailableState(
      definition,
      'fixture',
      `${definition.displayName} fixture is available, but no compatible score is registered yet; replay remains available.`,
      result.state,
    );
  }

  return unavailableState(
    definition,
    'fixture',
    `${definition.displayName} is registered, but no fixture reader is available in the app yet.`,
  );
}

function evaluateSourceWeatherFrame(
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

const MOCK_SENSOR_FIXTURE: RecordedMockSensorPayload = {
  provider: 'mock-sensor',
  observedAt: '2026-06-15T12:00:00.000Z',
  receivedAt: '2026-06-15T12:00:01.000Z',
  device: {
    id: 'studio-controller',
    label: 'Studio Controller',
  },
  reading: {
    acceleration: [0.1, -0.2, 0.3],
    orientation: [12.125, 0, 181.988],
    contact: true,
    batteryPercent: 87.45,
  },
};
