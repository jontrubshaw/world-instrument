import {
  STREAM_STATE_SCHEMA_VERSION,
  type BooleanStreamSample,
  type CategoricalStreamSample,
  type JsonObject,
  type NormalizedStreamState,
  type NumericStreamSample,
  type StreamAdapter,
  type StreamAdapterResult,
  type StreamReadRequest,
  type StreamSample,
  type StreamSampleQuality,
  type StreamSource,
  type StreamSourceLocation,
  type VectorStreamSample,
} from '@world-instrument/core';

export const WEATHER_ADAPTER_ID = 'weather.open-meteo';
export const WEATHER_ADAPTER_VERSION = '1.0.0';
export const WEATHER_CREDENTIAL_ENV = 'WORLD_INSTRUMENT_WEATHER_API_KEY';

const OPEN_METEO_CURRENT_FIELDS = [
  'temperature_2m',
  'apparent_temperature',
  'relative_humidity_2m',
  'precipitation',
  'rain',
  'weather_code',
  'cloud_cover',
  'surface_pressure',
  'wind_speed_10m',
  'wind_direction_10m',
] as const;

export interface WeatherLocation extends StreamSourceLocation {}

export interface RecordedWeatherPayload {
  readonly provider: 'open-meteo';
  readonly observedAt: string;
  readonly receivedAt?: string;
  readonly sourceUri?: string;
  readonly location: WeatherLocation;
  readonly current: WeatherCurrentPayload;
}

export interface WeatherCurrentPayload {
  readonly temperatureCelsius?: number;
  readonly apparentTemperatureCelsius?: number;
  readonly relativeHumidityPercent?: number;
  readonly precipitationMm?: number;
  readonly rainMm?: number;
  readonly weatherCode?: number;
  readonly cloudCoverPercent?: number;
  readonly pressureHpa?: number;
  readonly windSpeedMetersPerSecond?: number;
  readonly windDirectionDegrees?: number;
}

export interface WeatherAdapterFailurePayload {
  readonly provider: 'live';
  readonly observedAt: string;
  readonly receivedAt: string;
  readonly location: WeatherLocation;
  readonly ok: false;
  readonly error: {
    readonly code: 'fetch-failed' | 'invalid-payload' | 'missing-credentials' | 'missing-fetch';
    readonly message: string;
  };
}

export type WeatherAdapterRaw = RecordedWeatherPayload | WeatherAdapterFailurePayload;

export interface WeatherFixtureAdapterConfig {
  readonly mode: 'fixture';
  readonly fixture: RecordedWeatherPayload;
  readonly sequence?: number;
  readonly streamId?: string;
  readonly sourceId?: string;
}

export interface WeatherLiveAdapterConfig {
  readonly mode: 'live';
  readonly endpointUrl: string;
  readonly location: WeatherLocation;
  readonly apiKey?: string;
  readonly credentialEnvName?: string;
  readonly requiresCredential?: boolean;
  readonly fetchWeather?: WeatherFetch;
  readonly receivedAt?: string;
  readonly sequence?: number;
  readonly streamId?: string;
  readonly sourceId?: string;
}

export type WeatherAdapterConfig = WeatherFixtureAdapterConfig | WeatherLiveAdapterConfig;

export type WeatherFetch = (
  url: string,
  init: { readonly headers: Readonly<Record<string, string>>; readonly signal?: AbortSignal },
) => Promise<WeatherFetchResponse>;

export interface WeatherFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

export interface NormalizeWeatherOptions {
  readonly mode?: 'fixture' | 'live';
  readonly receivedAt?: string;
  readonly sequence?: number;
  readonly sourceId?: string;
  readonly streamId?: string;
}

export class WeatherAdapter implements StreamAdapter<WeatherAdapterRaw, WeatherAdapterConfig> {
  readonly id = WEATHER_ADAPTER_ID;
  readonly version = WEATHER_ADAPTER_VERSION;

  #config: WeatherAdapterConfig;

  constructor(config: WeatherAdapterConfig) {
    this.#config = config;
  }

  get source(): StreamSource {
    const location =
      this.#config.mode === 'fixture' ? this.#config.fixture.location : this.#config.location;

    return {
      id: this.#config.sourceId ?? `${WEATHER_ADAPTER_ID}:${location.id}`,
      kind: 'weather',
      label: `${location.label} weather`,
    };
  }

  configure(config: WeatherAdapterConfig): void {
    this.#config = config;
  }

  async read(request: StreamReadRequest = {}): Promise<StreamAdapterResult<WeatherAdapterRaw>> {
    const sequence = nextSequence(this.#config.sequence, request.afterSequence);

    if (this.#config.mode === 'fixture') {
      return {
        raw: this.#config.fixture,
        state: normalizeWeatherPayload(
          this.#config.fixture,
          createNormalizeOptions('fixture', sequence, this.#config.sourceId, this.#config.streamId),
        ),
      };
    }

    return this.readLive(this.#config, request, sequence);
  }

  private async readLive(
    config: WeatherLiveAdapterConfig,
    request: StreamReadRequest,
    sequence: number,
  ): Promise<StreamAdapterResult<WeatherAdapterRaw>> {
    const receivedAt = config.receivedAt ?? new Date().toISOString();
    const credentialEnvName = config.credentialEnvName ?? WEATHER_CREDENTIAL_ENV;
    const apiKey =
      config.apiKey ??
      (config.requiresCredential === true ? readCredentialFromEnv(credentialEnvName) : undefined);

    if (config.requiresCredential === true && (apiKey === undefined || apiKey.length === 0)) {
      return createFailureResult(config, {
        code: 'missing-credentials',
        message: `Weather live mode requires apiKey or ${credentialEnvName}.`,
        receivedAt,
        sequence,
      });
    }

    const fetchWeather = config.fetchWeather ?? createGlobalWeatherFetch();

    if (fetchWeather === undefined) {
      return createFailureResult(config, {
        code: 'missing-fetch',
        message: 'Weather live mode requires a fetch implementation.',
        receivedAt,
        sequence,
      });
    }

    try {
      const url = buildLiveUrl(config.endpointUrl, config.location, apiKey);
      const sourceUri = sanitizeLiveSourceUri(url);
      const response = await fetchWeather(url, {
        headers: {
          accept: 'application/json',
        },
        ...(request.signal === undefined ? {} : { signal: request.signal }),
      });

      if (!response.ok) {
        return createFailureResult(config, {
          code: 'fetch-failed',
          message: `Weather provider request failed with HTTP ${String(response.status)}.`,
          receivedAt,
          sequence,
        });
      }

      const payload = mapOpenMeteoResponse(
        await response.json(),
        config.location,
        receivedAt,
        sourceUri,
      );

      if (payload === undefined) {
        return createFailureResult(config, {
          code: 'invalid-payload',
          message: 'Weather provider response did not match the recorded weather payload contract.',
          receivedAt,
          sequence,
        });
      }

      return {
        raw: payload,
        state: normalizeWeatherPayload(
          payload,
          createNormalizeOptions('live', sequence, config.sourceId, config.streamId, receivedAt),
        ),
      };
    } catch (error) {
      return createFailureResult(config, {
        code: 'fetch-failed',
        message: error instanceof Error ? error.message : 'Weather provider request failed.',
        receivedAt,
        sequence,
      });
    }
  }
}

export function normalizeWeatherPayload(
  payload: RecordedWeatherPayload,
  options: NormalizeWeatherOptions = {},
): NormalizedStreamState {
  const observedAt = payload.observedAt;
  const receivedAt = options.receivedAt ?? payload.receivedAt ?? observedAt;
  const condition = weatherCodeToCondition(payload.current.weatherCode);
  const source = createWeatherSource(payload, options);

  return {
    schemaVersion: STREAM_STATE_SCHEMA_VERSION,
    streamId: options.streamId ?? `weather:${payload.location.id}`,
    source,
    status: 'ok',
    observedAt,
    receivedAt,
    sequence: options.sequence ?? 0,
    samples: createWeatherSamples(payload.current, observedAt, condition),
    metadata: {
      provider: payload.provider,
      mode: options.mode ?? 'fixture',
      condition,
      weatherCode: finiteOrFallback(payload.current.weatherCode, -1),
      location: serializeLocation(payload.location),
    },
  };
}

function createFailureResult(
  config: WeatherLiveAdapterConfig,
  failure: {
    readonly code: WeatherAdapterFailurePayload['error']['code'];
    readonly message: string;
    readonly receivedAt: string;
    readonly sequence: number;
  },
): StreamAdapterResult<WeatherAdapterFailurePayload> {
  const raw: WeatherAdapterFailurePayload = {
    provider: 'live',
    observedAt: failure.receivedAt,
    receivedAt: failure.receivedAt,
    location: config.location,
    ok: false,
    error: {
      code: failure.code,
      message: failure.message,
    },
  };

  return {
    raw,
    state: createFailureState(config, raw, failure.sequence),
  };
}

function createFailureState(
  config: WeatherLiveAdapterConfig,
  raw: WeatherAdapterFailurePayload,
  sequence: number,
): NormalizedStreamState {
  return {
    schemaVersion: STREAM_STATE_SCHEMA_VERSION,
    streamId: config.streamId ?? `weather:${config.location.id}`,
    source: {
      id: config.sourceId ?? `${WEATHER_ADAPTER_ID}:${config.location.id}`,
      kind: 'weather',
      label: `${config.location.label} weather`,
    },
    status: 'error',
    observedAt: raw.observedAt,
    receivedAt: raw.receivedAt,
    sequence,
    samples: createMissingWeatherSamples(raw.observedAt),
    metadata: {
      provider: 'live',
      mode: 'live',
      error: raw.error,
      location: serializeLocation(config.location),
    },
  };
}

function createWeatherSource(
  payload: RecordedWeatherPayload,
  options: NormalizeWeatherOptions,
): StreamSource {
  return {
    id: options.sourceId ?? `${WEATHER_ADAPTER_ID}:${payload.location.id}`,
    kind: 'weather',
    label: `${payload.location.label} weather`,
    ...(payload.sourceUri === undefined ? {} : { uri: payload.sourceUri }),
  };
}

function createWeatherSamples(
  current: WeatherCurrentPayload,
  observedAt: string,
  condition: string,
): readonly StreamSample[] {
  return [
    numericSample('temperature', 'Temperature', current.temperatureCelsius, observedAt, 'celsius'),
    numericSample(
      'apparentTemperature',
      'Apparent temperature',
      current.apparentTemperatureCelsius,
      observedAt,
      'celsius',
    ),
    numericSample(
      'relativeHumidity',
      'Relative humidity',
      current.relativeHumidityPercent,
      observedAt,
      'percent',
    ),
    numericSample('precipitation', 'Precipitation', current.precipitationMm, observedAt, 'mm'),
    numericSample('rain', 'Rain', current.rainMm, observedAt, 'mm'),
    numericSample('pressure', 'Surface pressure', current.pressureHpa, observedAt, 'hPa'),
    numericSample('cloudCover', 'Cloud cover', current.cloudCoverPercent, observedAt, 'percent'),
    numericSample('windSpeed', 'Wind speed', current.windSpeedMetersPerSecond, observedAt, 'm/s'),
    conditionSample(condition, current.weatherCode, observedAt),
    isRainingSample(current, observedAt),
    windVectorSample(current, observedAt),
  ];
}

function createMissingWeatherSamples(observedAt: string): readonly StreamSample[] {
  return [
    numericSample('temperature', 'Temperature', undefined, observedAt, 'celsius'),
    numericSample('relativeHumidity', 'Relative humidity', undefined, observedAt, 'percent'),
    numericSample('windSpeed', 'Wind speed', undefined, observedAt, 'm/s'),
    conditionSample('unknown', undefined, observedAt),
    isRainingSample({}, observedAt),
    windVectorSample({}, observedAt),
  ];
}

function numericSample(
  key: string,
  label: string,
  value: number | undefined,
  observedAt: string,
  unit: string,
): NumericStreamSample {
  const measured = isFiniteNumber(value);
  const quality: StreamSampleQuality = measured ? 'measured' : 'missing';

  return {
    kind: 'numeric',
    key,
    label,
    observedAt,
    quality,
    value: measured ? round(value) : 0,
    unit,
  };
}

function conditionSample(
  condition: string,
  weatherCode: number | undefined,
  observedAt: string,
): CategoricalStreamSample {
  const measured = isFiniteNumber(weatherCode);

  return {
    kind: 'categorical',
    key: 'condition',
    label: 'Weather condition',
    observedAt,
    quality: measured ? 'estimated' : 'missing',
    value: condition,
    ...(measured ? { confidence: 0.86 } : {}),
  };
}

function isRainingSample(current: WeatherCurrentPayload, observedAt: string): BooleanStreamSample {
  const precipitation = current.precipitationMm ?? 0;
  const rain = current.rainMm ?? 0;
  const measured = isFiniteNumber(current.precipitationMm) || isFiniteNumber(current.rainMm);
  const quality: StreamSampleQuality = measured ? 'measured' : 'missing';

  return {
    kind: 'boolean',
    key: 'isRaining',
    label: 'Is raining',
    observedAt,
    quality,
    value: precipitation > 0 || rain > 0,
    ...(measured ? { confidence: 0.9 } : {}),
  };
}

function windVectorSample(current: WeatherCurrentPayload, observedAt: string): VectorStreamSample {
  const speed = current.windSpeedMetersPerSecond;
  const direction = current.windDirectionDegrees;
  const measured = isFiniteNumber(speed) && isFiniteNumber(direction);
  const magnitude = measured ? normalizeToUnit(speed, 0, 30) : 0;
  const radians = measured ? (direction * Math.PI) / 180 : 0;

  return {
    kind: 'vector',
    key: 'windVector',
    label: 'Wind vector',
    observedAt,
    quality: measured ? 'estimated' : 'missing',
    values: [round(Math.sin(radians) * magnitude), round(Math.cos(radians) * magnitude)],
    axes: ['east', 'north'],
    unit: 'normalized',
  };
}

function weatherCodeToCondition(weatherCode: number | undefined): string {
  if (!isFiniteNumber(weatherCode)) {
    return 'unknown';
  }

  if (weatherCode === 0) {
    return 'clear';
  }

  if (weatherCode === 1 || weatherCode === 2) {
    return 'partly-cloudy';
  }

  if (weatherCode === 3) {
    return 'overcast';
  }

  if (weatherCode === 45 || weatherCode === 48) {
    return 'fog';
  }

  if ((weatherCode >= 51 && weatherCode <= 67) || (weatherCode >= 80 && weatherCode <= 82)) {
    return 'rain';
  }

  if ((weatherCode >= 71 && weatherCode <= 77) || weatherCode === 85 || weatherCode === 86) {
    return 'snow';
  }

  if (weatherCode >= 95) {
    return 'storm';
  }

  return 'mixed';
}

function mapOpenMeteoResponse(
  value: unknown,
  fallbackLocation: WeatherLocation,
  receivedAt: string,
  sourceUri: string,
): RecordedWeatherPayload | undefined {
  if (!isRecord(value) || !isRecord(value.current)) {
    return undefined;
  }

  const observedAt = parseOpenMeteoObservedAt(value.current.time);
  if (observedAt === undefined) {
    return undefined;
  }

  return {
    provider: 'open-meteo',
    observedAt,
    receivedAt,
    sourceUri,
    location: {
      ...fallbackLocation,
      ...(typeof value.timezone === 'string' ? { timezone: value.timezone } : {}),
    },
    current: parseOpenMeteoCurrent(value.current),
  };
}

function parseOpenMeteoCurrent(value: Record<string, unknown>): WeatherCurrentPayload {
  const current: MutableWeatherCurrentPayload = {};
  assignFinite(current, 'temperatureCelsius', value.temperature_2m);
  assignFinite(current, 'apparentTemperatureCelsius', value.apparent_temperature);
  assignFinite(current, 'relativeHumidityPercent', value.relative_humidity_2m);
  assignFinite(current, 'precipitationMm', value.precipitation);
  assignFinite(current, 'rainMm', value.rain);
  assignFinite(current, 'weatherCode', value.weather_code);
  assignFinite(current, 'cloudCoverPercent', value.cloud_cover);
  assignFinite(current, 'pressureHpa', value.surface_pressure);
  assignFinite(current, 'windSpeedMetersPerSecond', value.wind_speed_10m);
  assignFinite(current, 'windDirectionDegrees', value.wind_direction_10m);

  return current;
}

function parseOpenMeteoObservedAt(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }

  const timestamp = /(?:Z|[+-]\d{2}:?\d{2})$/u.test(value) ? value : `${value}Z`;
  const parsed = new Date(timestamp);

  return Number.isNaN(parsed.valueOf()) ? undefined : parsed.toISOString();
}

function buildLiveUrl(
  endpointUrl: string,
  location: WeatherLocation,
  apiKey: string | undefined,
): string {
  const url = new URL(endpointUrl);
  url.searchParams.set('latitude', String(location.latitude));
  url.searchParams.set('longitude', String(location.longitude));
  url.searchParams.set('current', OPEN_METEO_CURRENT_FIELDS.join(','));
  url.searchParams.set('timezone', 'GMT');
  url.searchParams.set('wind_speed_unit', 'ms');

  if (apiKey !== undefined && apiKey.length > 0) {
    url.searchParams.set('apikey', apiKey);
  }

  return url.toString();
}

function sanitizeLiveSourceUri(sourceUri: string): string {
  const url = new URL(sourceUri);
  url.searchParams.delete('apikey');

  return url.toString();
}

function readCredentialFromEnv(credentialEnvName: string): string | undefined {
  if (typeof process === 'undefined') {
    return undefined;
  }

  return process.env[credentialEnvName];
}

function serializeLocation(location: WeatherLocation): JsonObject {
  return {
    id: location.id,
    label: location.label,
    latitude: location.latitude,
    longitude: location.longitude,
    ...(location.timezone === undefined ? {} : { timezone: location.timezone }),
  };
}

function createNormalizeOptions(
  mode: 'fixture' | 'live',
  sequence: number,
  sourceId: string | undefined,
  streamId: string | undefined,
  receivedAt?: string,
): NormalizeWeatherOptions {
  return {
    mode,
    sequence,
    ...(receivedAt === undefined ? {} : { receivedAt }),
    ...(sourceId === undefined ? {} : { sourceId }),
    ...(streamId === undefined ? {} : { streamId }),
  };
}

function createGlobalWeatherFetch(): WeatherFetch | undefined {
  const fetchCandidate = globalThis.fetch as typeof globalThis.fetch | undefined;

  if (fetchCandidate === undefined) {
    return undefined;
  }

  return async (url, init) => {
    const response = await fetchCandidate(url, {
      headers: init.headers,
      ...(init.signal === undefined ? {} : { signal: init.signal }),
    });

    return {
      ok: response.ok,
      status: response.status,
      json: () => response.json() as Promise<unknown>,
    };
  };
}

function nextSequence(
  configuredSequence: number | undefined,
  afterSequence: number | undefined,
): number {
  if (configuredSequence !== undefined) {
    return configuredSequence;
  }

  return afterSequence === undefined ? 0 : afterSequence + 1;
}

function normalizeToUnit(value: number, min: number, max: number): number {
  return Math.min(Math.max((value - min) / (max - min), 0), 1);
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function finiteOrFallback(value: number | undefined, fallback: number): number {
  return isFiniteNumber(value) ? value : fallback;
}

type MutableWeatherCurrentPayload = {
  -readonly [Key in keyof WeatherCurrentPayload]?: number;
};

function assignFinite(
  target: MutableWeatherCurrentPayload,
  key: keyof MutableWeatherCurrentPayload,
  value: unknown,
): void {
  if (isFiniteNumber(value)) {
    target[key] = value;
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
