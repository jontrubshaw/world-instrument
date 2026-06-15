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
  type StreamStatus,
  type VectorStreamSample,
} from '@world-instrument/core';

export const BROWSER_SENSOR_ADAPTER_ID = 'sensor.browser-interaction';
export const BROWSER_SENSOR_ADAPTER_VERSION = '1.0.0';

export type BrowserSensorPermissionState =
  | 'denied'
  | 'granted'
  | 'prompt'
  | 'unsupported'
  | 'unknown';
export type BrowserSensorFallbackState = 'idle' | 'none' | 'pointer';

export interface BrowserSensorSession {
  readonly id: string;
  readonly label: string;
}

export interface BrowserSensorCapabilityState {
  readonly pointer: 'available' | 'unavailable';
  readonly motion: BrowserSensorPermissionState;
  readonly orientation: BrowserSensorPermissionState;
  readonly fallback: BrowserSensorFallbackState;
}

export interface BrowserPointerReading {
  readonly x: number;
  readonly y: number;
  readonly deltaX: number;
  readonly deltaY: number;
  readonly pressure?: number;
  readonly buttons?: number;
  readonly active: boolean;
  readonly viewportWidth?: number;
  readonly viewportHeight?: number;
}

export interface BrowserMotionReading {
  readonly acceleration?: readonly number[];
  readonly rotationRate?: readonly number[];
  readonly intervalMs?: number;
}

export interface BrowserOrientationReading {
  readonly alpha?: number;
  readonly beta?: number;
  readonly gamma?: number;
  readonly absolute?: boolean;
}

export interface BrowserSensorReadingPayload {
  readonly pointer?: BrowserPointerReading;
  readonly motion?: BrowserMotionReading;
  readonly orientation?: BrowserOrientationReading;
}

export interface RecordedBrowserSensorPayload {
  readonly provider: 'browser-sensor';
  readonly observedAt: string;
  readonly receivedAt?: string;
  readonly session: BrowserSensorSession;
  readonly capability: BrowserSensorCapabilityState;
  readonly reading: BrowserSensorReadingPayload;
  readonly eventCount?: number;
}

export interface BrowserSensorFixtureAdapterConfig {
  readonly mode: 'fixture';
  readonly fixture: RecordedBrowserSensorPayload;
  readonly sequence?: number;
  readonly streamId?: string;
  readonly sourceId?: string;
  readonly status?: StreamStatus;
}

export interface BrowserSensorLiveAdapterConfig {
  readonly mode: 'live';
  readonly readSensor: BrowserSensorRead;
  readonly sequence?: number;
  readonly streamId?: string;
  readonly sourceId?: string;
  readonly receivedAt?: string;
  readonly status?: StreamStatus;
}

export type BrowserSensorAdapterConfig =
  | BrowserSensorFixtureAdapterConfig
  | BrowserSensorLiveAdapterConfig;

export type BrowserSensorRead = (
  request?: StreamReadRequest,
) => Promise<RecordedBrowserSensorPayload> | RecordedBrowserSensorPayload;

export interface NormalizeBrowserSensorOptions {
  readonly mode?: 'fixture' | 'live';
  readonly receivedAt?: string;
  readonly sequence?: number;
  readonly sourceId?: string;
  readonly streamId?: string;
  readonly status?: StreamStatus;
}

export class BrowserSensorAdapter implements StreamAdapter<
  RecordedBrowserSensorPayload,
  BrowserSensorAdapterConfig
> {
  readonly id = BROWSER_SENSOR_ADAPTER_ID;
  readonly version = BROWSER_SENSOR_ADAPTER_VERSION;

  #config: BrowserSensorAdapterConfig;

  constructor(config: BrowserSensorAdapterConfig) {
    this.#config = config;
  }

  get source(): StreamSource {
    const session =
      this.#config.mode === 'fixture'
        ? this.#config.fixture.session
        : { id: 'local-browser', label: 'Browser interaction' };

    return createBrowserSensorSource(session, this.#config);
  }

  configure(config: BrowserSensorAdapterConfig): void {
    this.#config = config;
  }

  async read(
    request: StreamReadRequest = {},
  ): Promise<StreamAdapterResult<RecordedBrowserSensorPayload>> {
    const sequence = nextSequence(this.#config.sequence, request.afterSequence);
    const payload =
      this.#config.mode === 'fixture'
        ? this.#config.fixture
        : await this.#config.readSensor(request);
    const mode = this.#config.mode;

    return {
      raw: payload,
      state: normalizeBrowserSensorPayload(payload, {
        mode,
        sequence,
        ...(this.#config.status === undefined ? {} : { status: this.#config.status }),
        ...(this.#config.sourceId === undefined ? {} : { sourceId: this.#config.sourceId }),
        ...(this.#config.streamId === undefined ? {} : { streamId: this.#config.streamId }),
        ...(this.#config.mode !== 'live' || this.#config.receivedAt === undefined
          ? {}
          : { receivedAt: this.#config.receivedAt }),
      }),
    };
  }
}

export function normalizeBrowserSensorPayload(
  payload: RecordedBrowserSensorPayload,
  options: NormalizeBrowserSensorOptions = {},
): NormalizedStreamState {
  const observedAt = payload.observedAt;
  const receivedAt = options.receivedAt ?? payload.receivedAt ?? observedAt;
  const samples = createBrowserSensorSamples(payload, observedAt);

  return {
    schemaVersion: STREAM_STATE_SCHEMA_VERSION,
    streamId: options.streamId ?? `sensor:${payload.session.id}`,
    source: createBrowserSensorSource(payload.session, options),
    status: options.status ?? statusForCapability(payload.capability),
    observedAt,
    receivedAt,
    sequence: options.sequence ?? 0,
    samples,
    metadata: {
      provider: payload.provider,
      mode: options.mode ?? 'fixture',
      session: serializeSession(payload.session),
      capability: serializeCapability(payload.capability),
      eventCount: payload.eventCount ?? 0,
    },
  };
}

export function createBrowserSensorFixturePayload(
  options: {
    readonly observedAt?: string;
    readonly receivedAt?: string;
    readonly sequence?: number;
    readonly session?: BrowserSensorSession;
    readonly pointerX?: number;
    readonly pointerY?: number;
    readonly deltaX?: number;
    readonly deltaY?: number;
    readonly pressure?: number;
    readonly active?: boolean;
    readonly motion?: readonly number[];
    readonly orientation?: readonly number[];
  } = {},
): RecordedBrowserSensorPayload {
  const session = options.session ?? {
    id: 'studio-browser',
    label: 'Studio browser',
  };
  const hasMotion = options.motion !== undefined && options.motion.every(isFiniteNumber);
  const hasOrientation =
    options.orientation !== undefined &&
    options.orientation.length >= 3 &&
    options.orientation.every(isFiniteNumber);

  return {
    provider: 'browser-sensor',
    observedAt: options.observedAt ?? '2026-06-15T12:05:00.000Z',
    receivedAt: options.receivedAt ?? '2026-06-15T12:05:00.100Z',
    session,
    capability: {
      pointer: 'available',
      motion: hasMotion ? 'granted' : 'unsupported',
      orientation: hasOrientation ? 'granted' : 'unsupported',
      fallback: hasMotion || hasOrientation ? 'none' : 'pointer',
    },
    reading: {
      pointer: {
        x: options.pointerX ?? 0.62,
        y: options.pointerY ?? 0.38,
        deltaX: options.deltaX ?? 0.04,
        deltaY: options.deltaY ?? -0.03,
        ...(options.pressure === undefined ? {} : { pressure: options.pressure }),
        active: options.active ?? true,
      },
      ...(hasMotion ? { motion: { acceleration: options.motion } } : {}),
      ...(hasOrientation
        ? {
            orientation: {
              alpha: options.orientation?.[0],
              beta: options.orientation?.[1],
              gamma: options.orientation?.[2],
              absolute: false,
            },
          }
        : {}),
    },
    eventCount: options.sequence ?? 1,
  };
}

function createBrowserSensorSource(
  session: BrowserSensorSession,
  options: Pick<NormalizeBrowserSensorOptions, 'sourceId'>,
): StreamSource {
  return {
    id: options.sourceId ?? `${BROWSER_SENSOR_ADAPTER_ID}:${session.id}`,
    kind: 'sensor',
    label: `${session.label} sensor`,
  };
}

function createBrowserSensorSamples(
  payload: RecordedBrowserSensorPayload,
  observedAt: string,
): readonly StreamSample[] {
  return [
    pointerPositionSample(payload.reading.pointer, observedAt),
    pointerDeltaSample(payload.reading.pointer, observedAt),
    numericSample(
      'pointerPressure',
      'Pointer pressure',
      payload.reading.pointer?.pressure,
      observedAt,
      'normalized',
    ),
    vectorSample(
      'motion',
      'Device motion',
      payload.reading.motion?.acceleration,
      observedAt,
      ['x', 'y', 'z'],
      'm/s2',
    ),
    vectorSample(
      'rotationRate',
      'Device rotation rate',
      payload.reading.motion?.rotationRate,
      observedAt,
      ['alpha', 'beta', 'gamma'],
      'degrees/s',
    ),
    vectorSample(
      'orientation',
      'Device orientation',
      orientationValues(payload.reading.orientation),
      observedAt,
      ['alpha', 'beta', 'gamma'],
      'degrees',
    ),
    booleanSample(
      'interactionActive',
      'Interaction active',
      payload.reading.pointer?.active,
      observedAt,
    ),
    booleanSample(
      'fallbackActive',
      'Pointer fallback active',
      payload.capability.fallback !== 'none',
      observedAt,
    ),
    capabilitySample(payload.capability, observedAt),
  ];
}

function pointerPositionSample(
  pointer: BrowserPointerReading | undefined,
  observedAt: string,
): VectorStreamSample {
  return {
    kind: 'vector',
    key: 'pointerPosition',
    label: 'Pointer position',
    observedAt,
    quality: pointer === undefined ? 'missing' : 'measured',
    values: [round(clamp(pointer?.x ?? 0.5, 0, 1)), round(clamp(pointer?.y ?? 0.5, 0, 1))],
    axes: ['x', 'y'],
    unit: 'normalized',
  };
}

function pointerDeltaSample(
  pointer: BrowserPointerReading | undefined,
  observedAt: string,
): VectorStreamSample {
  return {
    kind: 'vector',
    key: 'pointerDelta',
    label: 'Pointer movement delta',
    observedAt,
    quality: pointer === undefined ? 'missing' : 'measured',
    values: [round(clamp(pointer?.deltaX ?? 0, -1, 1)), round(clamp(pointer?.deltaY ?? 0, -1, 1))],
    axes: ['x', 'y'],
    unit: 'normalized',
  };
}

function vectorSample(
  key: string,
  label: string,
  values: readonly number[] | undefined,
  observedAt: string,
  axes: readonly string[],
  unit: string,
): VectorStreamSample {
  const measured = values !== undefined && values.length > 0 && values.every(isFiniteNumber);
  const quality: StreamSampleQuality = measured ? 'measured' : 'missing';

  return {
    kind: 'vector',
    key,
    label,
    observedAt,
    quality,
    values: measured ? values.map(round) : axes.map(() => 0),
    axes,
    unit,
  };
}

function numericSample(
  key: string,
  label: string,
  value: number | undefined,
  observedAt: string,
  unit: string,
): NumericStreamSample {
  const measured = isFiniteNumber(value);

  return {
    kind: 'numeric',
    key,
    label,
    observedAt,
    quality: measured ? 'measured' : 'missing',
    value: measured ? round(clamp(value, 0, 1)) : 0,
    unit,
  };
}

function booleanSample(
  key: string,
  label: string,
  value: boolean | undefined,
  observedAt: string,
): BooleanStreamSample {
  const measured = value !== undefined;

  return {
    kind: 'boolean',
    key,
    label,
    observedAt,
    quality: measured ? 'measured' : 'missing',
    value: value ?? false,
    ...(measured ? { confidence: 1 } : {}),
  };
}

function capabilitySample(
  capability: BrowserSensorCapabilityState,
  observedAt: string,
): CategoricalStreamSample {
  return {
    kind: 'categorical',
    key: 'sensorCapability',
    label: 'Sensor capability',
    observedAt,
    quality: 'estimated',
    value: capabilityLabel(capability),
    confidence: capability.fallback === 'none' ? 0.95 : 0.8,
  };
}

function statusForCapability(capability: BrowserSensorCapabilityState): StreamStatus {
  if (capability.pointer === 'unavailable') {
    return 'error';
  }

  return capability.fallback === 'none' ? 'ok' : 'degraded';
}

function capabilityLabel(capability: BrowserSensorCapabilityState): string {
  if (capability.motion === 'granted' || capability.orientation === 'granted') {
    return 'device-sensor';
  }

  if (capability.pointer === 'available') {
    return capability.fallback === 'idle' ? 'idle-pointer' : 'pointer';
  }

  return 'unavailable';
}

function orientationValues(
  orientation: BrowserOrientationReading | undefined,
): readonly number[] | undefined {
  if (
    orientation === undefined ||
    !isFiniteNumber(orientation.alpha) ||
    !isFiniteNumber(orientation.beta) ||
    !isFiniteNumber(orientation.gamma)
  ) {
    return undefined;
  }

  return [orientation.alpha, orientation.beta, orientation.gamma];
}

function serializeSession(session: BrowserSensorSession): JsonObject {
  return {
    id: session.id,
    label: session.label,
  };
}

function serializeCapability(capability: BrowserSensorCapabilityState): JsonObject {
  return {
    pointer: capability.pointer,
    motion: capability.motion,
    orientation: capability.orientation,
    fallback: capability.fallback,
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

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
