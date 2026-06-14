import {
  STREAM_STATE_SCHEMA_VERSION,
  type BooleanStreamSample,
  type CategoricalStreamSample,
  type NormalizedStreamState,
  type NumericStreamSample,
  type StreamAdapter,
  type StreamAdapterResult,
  type StreamReadRequest,
  type StreamSample,
  type StreamSampleQuality,
  type StreamSource,
  type VectorStreamSample,
} from '@world-instrument/core';

export const RECORDED_WEATHER_SCHEMA_VERSION = 'recorded-weather.v1' as const;
export const WEATHER_ADAPTER_ID = 'weather';
export const WEATHER_ADAPTER_VERSION = '1.0.0';

export type RecordedWeatherSchemaVersion = typeof RECORDED_WEATHER_SCHEMA_VERSION;
export type WeatherAdapterMode = 'fixture' | 'live';
export type WeatherFailureCode = 'live_provider_unimplemented' | 'missing_credentials';

export interface WeatherProviderDescriptor {
  readonly id: string;
  readonly label?: string;
  readonly uri?: string;
}

export interface WeatherLocationDescriptor {
  readonly id: string;
  readonly label: string;
  readonly latitude: number;
  readonly longitude: number;
}

export interface RecordedWeatherWindVector {
  readonly values: readonly number[];
  readonly axes?: readonly string[];
  readonly unit?: string;
  readonly quality?: StreamSampleQuality;
}

export interface RecordedWeatherCurrentConditions {
  readonly observedAt: string;
  readonly temperatureCelsius: number;
  readonly temperatureDeltaCelsius?: number;
  readonly rollingAverageTemperatureCelsius?: number;
  readonly windSpeedMetersPerSecond: number;
  readonly condition: string;
  readonly conditionConfidence?: number;
  readonly isRaining: boolean;
  readonly rainConfidence?: number;
  readonly windVector?: RecordedWeatherWindVector;
}

export interface RecordedWeatherPayload {
  readonly schemaVersion: RecordedWeatherSchemaVersion;
  readonly provider: WeatherProviderDescriptor;
  readonly recording: {
    readonly kind: 'fixture';
    readonly recordedAt: string;
    readonly source?: string;
  };
  readonly location: WeatherLocationDescriptor;
  readonly sequence: number;
  readonly receivedAt: string;
  readonly current: RecordedWeatherCurrentConditions;
}

export interface WeatherAdapterFailurePayload {
  readonly error: {
    readonly code: WeatherFailureCode;
    readonly message: string;
    readonly provider: string;
  };
  readonly requestedAt: string;
}

export type WeatherRawPayload = RecordedWeatherPayload | WeatherAdapterFailurePayload;

export interface WeatherProviderCredentials {
  readonly apiKey?: string;
  readonly token?: string;
}

export interface WeatherFixtureAdapterConfig {
  readonly mode: 'fixture';
  readonly fixture: RecordedWeatherPayload;
}

export interface WeatherLiveAdapterConfig {
  readonly mode: 'live';
  readonly provider: WeatherProviderDescriptor;
  readonly location: WeatherLocationDescriptor;
  readonly credentials?: WeatherProviderCredentials;
  readonly requestedAt?: string;
}

export type WeatherAdapterConfig = WeatherFixtureAdapterConfig | WeatherLiveAdapterConfig;

export interface WeatherNormalizationOptions {
  readonly streamId?: string;
  readonly source?: StreamSource;
}

const WEATHER_SAMPLE_KEYS = [
  'temperature',
  'windSpeed',
  'condition',
  'isRaining',
  'windVector',
] as const;

const DEFAULT_LIVE_LOCATION: WeatherLocationDescriptor = {
  id: 'unknown',
  label: 'Unknown weather location',
  latitude: 0,
  longitude: 0,
};

export class WeatherAdapter implements StreamAdapter<WeatherRawPayload, WeatherAdapterConfig> {
  readonly id = WEATHER_ADAPTER_ID;
  readonly version = WEATHER_ADAPTER_VERSION;

  #config: WeatherAdapterConfig;

  constructor(config: WeatherAdapterConfig) {
    this.#config = config;
  }

  get source(): StreamSource {
    if (this.#config.mode === 'fixture') {
      return createWeatherSource(this.#config.fixture.provider, this.#config.fixture.location);
    }

    return createWeatherSource(this.#config.provider, this.#config.location);
  }

  configure(config: WeatherAdapterConfig): void {
    this.#config = config;
  }

  read(request?: StreamReadRequest): Promise<StreamAdapterResult<WeatherRawPayload>> {
    if (this.#config.mode === 'fixture') {
      return Promise.resolve({
        raw: this.#config.fixture,
        state: normalizeWeatherObservation(this.#config.fixture),
      });
    }

    return Promise.resolve(readLiveWeatherFailure(this.#config, request));
  }
}

export function normalizeWeatherObservation(
  raw: RecordedWeatherPayload,
  options: WeatherNormalizationOptions = {},
): NormalizedStreamState {
  assertRecordedWeatherPayload(raw);

  const source = options.source ?? createWeatherSource(raw.provider, raw.location);
  const observedAt = raw.current.observedAt;
  const windVector = raw.current.windVector;

  return {
    schemaVersion: STREAM_STATE_SCHEMA_VERSION,
    streamId: options.streamId ?? `weather:${raw.location.id}`,
    source,
    status: 'ok',
    observedAt,
    receivedAt: raw.receivedAt,
    sequence: raw.sequence,
    samples: [
      createTemperatureSample(raw.current, observedAt),
      createWindSpeedSample(raw.current, observedAt),
      createConditionSample(raw.current, observedAt),
      createRainSample(raw.current, observedAt),
      createWindVectorSample(windVector, observedAt),
    ],
    metadata: {
      provider: raw.recording.kind,
      upstreamProvider: raw.provider.id,
      recording: {
        recordedAt: raw.recording.recordedAt,
        ...(raw.recording.source === undefined ? {} : { source: raw.recording.source }),
      },
      location: {
        lat: raw.location.latitude,
        lon: raw.location.longitude,
      },
    },
  };
}

function readLiveWeatherFailure(
  config: WeatherLiveAdapterConfig,
  request: StreamReadRequest | undefined,
): StreamAdapterResult<WeatherAdapterFailurePayload> {
  if (!hasCredentials(config.credentials)) {
    return createFailureResult({
      code: 'missing_credentials',
      message: 'Live weather mode requires provider credentials before weather can be read.',
      provider: config.provider,
      location: config.location,
      request,
      requestedAt: config.requestedAt,
    });
  }

  return createFailureResult({
    code: 'live_provider_unimplemented',
    message: 'Live weather provider access is deferred until provider credentials are selected.',
    provider: config.provider,
    location: config.location,
    request,
    requestedAt: config.requestedAt,
  });
}

function createFailureResult(args: {
  readonly code: WeatherFailureCode;
  readonly message: string;
  readonly provider: WeatherProviderDescriptor;
  readonly location: WeatherLocationDescriptor;
  readonly request: StreamReadRequest | undefined;
  readonly requestedAt: string | undefined;
}): StreamAdapterResult<WeatherAdapterFailurePayload> {
  const requestedAt = args.requestedAt ?? '1970-01-01T00:00:00.000Z';
  const raw: WeatherAdapterFailurePayload = {
    error: {
      code: args.code,
      message: args.message,
      provider: args.provider.id,
    },
    requestedAt,
  };

  return {
    raw,
    state: {
      schemaVersion: STREAM_STATE_SCHEMA_VERSION,
      streamId: `weather:${args.location.id}`,
      source: createWeatherSource(args.provider, args.location),
      status: 'error',
      observedAt: requestedAt,
      receivedAt: requestedAt,
      sequence: (args.request?.afterSequence ?? -1) + 1,
      samples: createMissingWeatherSamples(requestedAt),
      metadata: {
        mode: 'live',
        provider: args.provider.id,
        error: raw.error,
        location: {
          lat: args.location.latitude,
          lon: args.location.longitude,
        },
      },
    },
  };
}

function createTemperatureSample(
  current: RecordedWeatherCurrentConditions,
  observedAt: string,
): NumericStreamSample {
  return {
    kind: 'numeric',
    key: 'temperature',
    label: 'Temperature',
    observedAt,
    quality: 'measured',
    value: current.temperatureCelsius,
    unit: 'celsius',
    ...(current.temperatureDeltaCelsius === undefined
      ? {}
      : { delta: current.temperatureDeltaCelsius }),
    ...(current.rollingAverageTemperatureCelsius === undefined
      ? {}
      : { rollingAverage: current.rollingAverageTemperatureCelsius }),
  };
}

function createWindSpeedSample(
  current: RecordedWeatherCurrentConditions,
  observedAt: string,
): NumericStreamSample {
  return {
    kind: 'numeric',
    key: 'windSpeed',
    label: 'Wind speed',
    observedAt,
    quality: 'measured',
    value: current.windSpeedMetersPerSecond,
    unit: 'm/s',
  };
}

function createConditionSample(
  current: RecordedWeatherCurrentConditions,
  observedAt: string,
): CategoricalStreamSample {
  return {
    kind: 'categorical',
    key: 'condition',
    label: 'Condition',
    observedAt,
    quality: 'measured',
    value: current.condition,
    ...(current.conditionConfidence === undefined
      ? {}
      : { confidence: current.conditionConfidence }),
  };
}

function createRainSample(
  current: RecordedWeatherCurrentConditions,
  observedAt: string,
): BooleanStreamSample {
  return {
    kind: 'boolean',
    key: 'isRaining',
    label: 'Is raining',
    observedAt,
    quality: 'measured',
    value: current.isRaining,
    ...(current.rainConfidence === undefined ? {} : { confidence: current.rainConfidence }),
  };
}

function createWindVectorSample(
  windVector: RecordedWeatherWindVector | undefined,
  observedAt: string,
): VectorStreamSample {
  return {
    kind: 'vector',
    key: 'windVector',
    label: 'Wind vector',
    observedAt,
    quality: windVector?.quality ?? 'estimated',
    values: windVector?.values ?? [0, 0],
    axes: windVector?.axes ?? ['x', 'y'],
    unit: windVector?.unit ?? 'normalized',
  };
}

function createMissingWeatherSamples(observedAt: string): readonly StreamSample[] {
  return WEATHER_SAMPLE_KEYS.map((key) => {
    if (key === 'condition') {
      return {
        kind: 'categorical',
        key,
        observedAt,
        quality: 'missing',
        value: 'unknown',
      } satisfies CategoricalStreamSample;
    }

    if (key === 'isRaining') {
      return {
        kind: 'boolean',
        key,
        observedAt,
        quality: 'missing',
        value: false,
      } satisfies BooleanStreamSample;
    }

    if (key === 'windVector') {
      return {
        kind: 'vector',
        key,
        observedAt,
        quality: 'missing',
        values: [0, 0],
        axes: ['x', 'y'],
        unit: 'normalized',
      } satisfies VectorStreamSample;
    }

    return {
      kind: 'numeric',
      key,
      observedAt,
      quality: 'missing',
      value: 0,
    } satisfies NumericStreamSample;
  });
}

function createWeatherSource(
  provider: WeatherProviderDescriptor,
  location: WeatherLocationDescriptor = DEFAULT_LIVE_LOCATION,
): StreamSource {
  return {
    id: `${provider.id}:${location.id}`,
    kind: 'weather',
    label: `${location.label} weather`,
    ...(provider.uri === undefined ? {} : { uri: provider.uri }),
  };
}

function hasCredentials(credentials: WeatherProviderCredentials | undefined): boolean {
  return (
    credentials !== undefined &&
    ((credentials.apiKey !== undefined && credentials.apiKey.length > 0) ||
      (credentials.token !== undefined && credentials.token.length > 0))
  );
}

function assertRecordedWeatherPayload(raw: RecordedWeatherPayload): void {
  assertSchemaVersion(raw.schemaVersion);
  assertTimestamp(raw.receivedAt, 'receivedAt');
  assertTimestamp(raw.current.observedAt, 'current.observedAt');
  assertTimestamp(raw.recording.recordedAt, 'recording.recordedAt');
  assertFiniteNumber(raw.sequence, 'sequence');
  assertFiniteNumber(raw.location.latitude, 'location.latitude');
  assertFiniteNumber(raw.location.longitude, 'location.longitude');
  assertFiniteNumber(raw.current.temperatureCelsius, 'current.temperatureCelsius');
  assertFiniteNumber(raw.current.windSpeedMetersPerSecond, 'current.windSpeedMetersPerSecond');
}

function assertSchemaVersion(value: RecordedWeatherSchemaVersion): void {
  if (value !== RECORDED_WEATHER_SCHEMA_VERSION) {
    throw new Error(`Unsupported weather fixture schema: ${String(value)}`);
  }
}

function assertTimestamp(value: string, label: string): void {
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`Weather payload ${label} must be a parseable timestamp`);
  }
}

function assertFiniteNumber(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`Weather payload ${label} must be a finite number`);
  }
}
