import {
  STREAM_STATE_SCHEMA_VERSION,
  type BooleanStreamSample,
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

export type BrowserSensorCapabilityState =
  | 'available'
  | 'denied'
  | 'permission-required'
  | 'unavailable'
  | 'unknown';

export type BrowserSensorPermissionState =
  | 'denied'
  | 'granted'
  | 'not-requested'
  | 'prompt'
  | 'unsupported'
  | 'unknown';

export interface BrowserSensorDevice {
  readonly id: string;
  readonly label: string;
}

export interface BrowserSensorCapabilities {
  readonly pointer: BrowserSensorCapabilityState;
  readonly deviceMotion: BrowserSensorCapabilityState;
  readonly deviceOrientation: BrowserSensorCapabilityState;
  readonly permission: BrowserSensorPermissionState;
  readonly fallback: 'none' | 'pointer' | 'synthetic';
}

export interface BrowserSensorPointerPayload {
  readonly position: readonly [number, number];
  readonly velocity?: readonly [number, number];
  readonly pressure?: number;
  readonly buttons?: number;
  readonly active?: boolean;
}

export interface BrowserSensorMotionPayload {
  readonly acceleration?: readonly [number, number, number];
  readonly rotationRate?: readonly [number, number, number];
  readonly intervalMs?: number;
}

export interface BrowserSensorOrientationPayload {
  readonly angles?: readonly [number, number, number];
  readonly absolute?: boolean;
}

export interface RecordedBrowserSensorPayload {
  readonly provider: 'browser-sensor';
  readonly observedAt: string;
  readonly receivedAt?: string;
  readonly device: BrowserSensorDevice;
  readonly capabilities: BrowserSensorCapabilities;
  readonly pointer?: BrowserSensorPointerPayload;
  readonly motion?: BrowserSensorMotionPayload;
  readonly orientation?: BrowserSensorOrientationPayload;
}

export interface BrowserSensorFixtureAdapterConfig {
  readonly mode: 'fixture';
  readonly fixture: RecordedBrowserSensorPayload;
  readonly sequence?: number;
  readonly streamId?: string;
  readonly sourceId?: string;
}

export interface BrowserSensorLiveAdapterConfig {
  readonly mode: 'live';
  readonly snapshot: RecordedBrowserSensorPayload;
  readonly now?: string;
  readonly staleAfterMs?: number;
  readonly sequence?: number;
  readonly streamId?: string;
  readonly sourceId?: string;
}

export type BrowserSensorAdapterConfig =
  | BrowserSensorFixtureAdapterConfig
  | BrowserSensorLiveAdapterConfig;

export interface NormalizeBrowserSensorOptions {
  readonly mode?: 'fixture' | 'live';
  readonly now?: string;
  readonly receivedAt?: string;
  readonly sequence?: number;
  readonly sourceId?: string;
  readonly staleAfterMs?: number;
  readonly streamId?: string;
}

export interface CreateDeterministicBrowserSensorSnapshotOptions {
  readonly device?: BrowserSensorDevice;
  readonly frameIndex?: number;
  readonly observedAt?: string;
  readonly receivedAt?: string;
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
    const payload = this.#config.mode === 'fixture' ? this.#config.fixture : this.#config.snapshot;

    return createBrowserSensorSource(payload, this.#config);
  }

  configure(config: BrowserSensorAdapterConfig): void {
    this.#config = config;
  }

  read(
    request: StreamReadRequest = {},
  ): Promise<StreamAdapterResult<RecordedBrowserSensorPayload>> {
    const payload = this.#config.mode === 'fixture' ? this.#config.fixture : this.#config.snapshot;
    const sequence = nextSequence(this.#config.sequence, request.afterSequence);

    return Promise.resolve({
      raw: payload,
      state: normalizeBrowserSensorPayload(payload, {
        mode: this.#config.mode,
        sequence,
        ...(this.#config.sourceId === undefined ? {} : { sourceId: this.#config.sourceId }),
        ...(this.#config.streamId === undefined ? {} : { streamId: this.#config.streamId }),
        ...(this.#config.mode === 'live' && this.#config.now !== undefined
          ? { now: this.#config.now }
          : {}),
        ...(this.#config.mode === 'live' && this.#config.staleAfterMs !== undefined
          ? { staleAfterMs: this.#config.staleAfterMs }
          : {}),
      }),
    });
  }
}

export function normalizeBrowserSensorPayload(
  payload: RecordedBrowserSensorPayload,
  options: NormalizeBrowserSensorOptions = {},
): NormalizedStreamState {
  const observedAt = payload.observedAt;
  const receivedAt = options.receivedAt ?? payload.receivedAt ?? observedAt;
  const source = createBrowserSensorSource(payload, options);
  const mode = options.mode ?? 'fixture';

  return {
    schemaVersion: STREAM_STATE_SCHEMA_VERSION,
    streamId: options.streamId ?? `sensor:${payload.device.id}`,
    source,
    status: sensorStreamStatus(payload, options),
    observedAt,
    receivedAt,
    sequence: options.sequence ?? 0,
    samples: createBrowserSensorSamples(payload, observedAt),
    metadata: {
      provider: payload.provider,
      mode,
      device: {
        id: payload.device.id,
        label: payload.device.label,
      },
      capabilities: serializeCapabilities(payload.capabilities),
      activeInputs: activeInputs(payload),
    },
  };
}

export function createDeterministicBrowserSensorSnapshot(
  options: CreateDeterministicBrowserSensorSnapshotOptions = {},
): RecordedBrowserSensorPayload {
  const frameIndex = options.frameIndex ?? 0;
  const phase = frameIndex * 0.41;
  const observedAt = options.observedAt ?? '2026-06-15T12:00:00.000Z';
  const device = options.device ?? {
    id: 'studio-browser',
    label: 'Studio browser',
  };
  const x = round(clamp(0.5 + Math.sin(phase) * 0.32, 0, 1));
  const y = round(clamp(0.5 + Math.cos(phase * 0.7) * 0.28, 0, 1));
  const velocityX = round(Math.cos(phase) * 0.08);
  const velocityY = round(Math.sin(phase * 0.7) * -0.06);
  const acceleration = [
    round(Math.sin(phase) * 2.4),
    round(Math.cos(phase * 1.3) * 1.8),
    round(Math.sin(phase * 0.5) * 0.25),
  ] as const;

  return {
    provider: 'browser-sensor',
    observedAt,
    ...(options.receivedAt === undefined ? {} : { receivedAt: options.receivedAt }),
    device,
    capabilities: {
      pointer: 'available',
      deviceMotion: 'available',
      deviceOrientation: 'available',
      permission: 'granted',
      fallback: 'pointer',
    },
    pointer: {
      position: [x, y],
      velocity: [velocityX, velocityY],
      pressure: round(0.28 + Math.abs(Math.sin(phase)) * 0.42),
      buttons: frameIndex % 2,
      active: frameIndex % 2 === 1,
    },
    motion: {
      acceleration,
      rotationRate: [
        round(Math.cos(phase) * 12),
        round(Math.sin(phase * 0.8) * 9),
        round(Math.sin(phase * 1.1) * 18),
      ],
      intervalMs: 16.7,
    },
    orientation: {
      angles: [
        round((180 + Math.sin(phase) * 80) % 360),
        round(Math.cos(phase * 0.9) * 30),
        round(Math.sin(phase * 1.2) * 40),
      ],
      absolute: false,
    },
  };
}

function createBrowserSensorSource(
  payload: RecordedBrowserSensorPayload,
  options: Pick<NormalizeBrowserSensorOptions, 'sourceId'>,
): StreamSource {
  return {
    id: options.sourceId ?? `${BROWSER_SENSOR_ADAPTER_ID}:${payload.device.id}`,
    kind: 'sensor',
    label: `${payload.device.label} sensor`,
    uri: 'browser://local-sensors',
  };
}

function createBrowserSensorSamples(
  payload: RecordedBrowserSensorPayload,
  observedAt: string,
): readonly StreamSample[] {
  const motionIntensity = calculateMotionIntensity(payload);

  return [
    vectorSample(
      'pointerPosition',
      'Pointer position',
      payload.pointer?.position,
      observedAt,
      ['x', 'y'],
      'normalized',
    ),
    vectorSample(
      'pointerVelocity',
      'Pointer velocity',
      payload.pointer?.velocity,
      observedAt,
      ['x', 'y'],
      'normalized/frame',
    ),
    numericSample(
      'pointerPressure',
      'Pointer pressure',
      payload.pointer?.pressure,
      observedAt,
      'normalized',
    ),
    booleanSample(
      'interactionActive',
      'Interaction active',
      payload.pointer?.active ?? pointerButtonsActive(payload.pointer?.buttons),
      observedAt,
    ),
    vectorSample(
      'acceleration',
      'Device acceleration without gravity',
      payload.motion?.acceleration,
      observedAt,
      ['x', 'y', 'z'],
      'm/s2',
    ),
    vectorSample(
      'rotationRate',
      'Device rotation rate',
      payload.motion?.rotationRate,
      observedAt,
      ['alpha', 'beta', 'gamma'],
      'degrees/s',
    ),
    vectorSample(
      'orientation',
      'Device orientation',
      payload.orientation?.angles,
      observedAt,
      ['alpha', 'beta', 'gamma'],
      'degrees',
    ),
    numericSample('motionIntensity', 'Motion intensity', motionIntensity, observedAt, 'normalized'),
  ];
}

function sensorStreamStatus(
  payload: RecordedBrowserSensorPayload,
  options: Pick<NormalizeBrowserSensorOptions, 'now' | 'staleAfterMs'>,
): StreamStatus {
  const now = options.now;
  const staleAfterMs = options.staleAfterMs;

  if (now !== undefined && staleAfterMs !== undefined) {
    const observedAtMs = Date.parse(payload.observedAt);
    const nowMs = Date.parse(now);

    if (
      !Number.isNaN(observedAtMs) &&
      !Number.isNaN(nowMs) &&
      nowMs - observedAtMs >= staleAfterMs
    ) {
      return 'stale';
    }
  }

  if (hasMeasuredDeviceSensor(payload)) {
    return 'ok';
  }

  if (hasMeasuredPointer(payload)) {
    return 'degraded';
  }

  return 'degraded';
}

function activeInputs(payload: RecordedBrowserSensorPayload): readonly string[] {
  const active: string[] = [];

  if (hasMeasuredPointer(payload)) {
    active.push('pointer');
  }

  if (
    isMeasuredVector(payload.motion?.acceleration) ||
    isMeasuredVector(payload.motion?.rotationRate)
  ) {
    active.push('deviceMotion');
  }

  if (isMeasuredVector(payload.orientation?.angles)) {
    active.push('deviceOrientation');
  }

  return active.length > 0 ? active : ['fallback'];
}

function serializeCapabilities(capabilities: BrowserSensorCapabilities): JsonObject {
  return {
    pointer: capabilities.pointer,
    deviceMotion: capabilities.deviceMotion,
    deviceOrientation: capabilities.deviceOrientation,
    permission: capabilities.permission,
    fallback: capabilities.fallback,
  };
}

function hasMeasuredDeviceSensor(payload: RecordedBrowserSensorPayload): boolean {
  return (
    isMeasuredVector(payload.motion?.acceleration) ||
    isMeasuredVector(payload.motion?.rotationRate) ||
    isMeasuredVector(payload.orientation?.angles)
  );
}

function hasMeasuredPointer(payload: RecordedBrowserSensorPayload): boolean {
  return isMeasuredVector(payload.pointer?.position);
}

function vectorSample(
  key: string,
  label: string,
  values: readonly number[] | undefined,
  observedAt: string,
  axes: readonly string[],
  unit: string,
): VectorStreamSample {
  const measured = isMeasuredVector(values);
  const normalizedValues = measured ? values.slice(0, axes.length).map(round) : axes.map(() => 0);

  return {
    kind: 'vector',
    key,
    label,
    observedAt,
    quality: measured ? 'measured' : 'missing',
    values: normalizedValues,
    axes,
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
    value: measured ? round(clamp(value, 0, 1)) : 0,
    unit,
  };
}

function calculateMotionIntensity(payload: RecordedBrowserSensorPayload): number {
  const pointerVelocity = vectorMagnitude(payload.pointer?.velocity);
  const accelerationMagnitude = vectorMagnitude(payload.motion?.acceleration);
  const rotationMagnitude = vectorMagnitude(payload.motion?.rotationRate);

  if (
    pointerVelocity === undefined &&
    accelerationMagnitude === undefined &&
    rotationMagnitude === undefined
  ) {
    return 0;
  }

  return round(
    clamp(
      (pointerVelocity === undefined ? 0 : normalize(pointerVelocity, 0, 0.35)) * 0.45 +
        (accelerationMagnitude === undefined ? 0 : normalize(accelerationMagnitude, 0, 8)) * 0.35 +
        (rotationMagnitude === undefined ? 0 : normalize(rotationMagnitude, 0, 180)) * 0.2,
      0,
      1,
    ),
  );
}

function pointerButtonsActive(buttons: number | undefined): boolean | undefined {
  if (buttons === undefined) {
    return undefined;
  }

  return buttons > 0;
}

function isMeasuredVector(values: readonly number[] | undefined): values is readonly number[] {
  return values !== undefined && values.length > 0 && values.every(isFiniteNumber);
}

function vectorMagnitude(values: readonly number[] | undefined): number | undefined {
  if (!isMeasuredVector(values)) {
    return undefined;
  }

  return Math.sqrt(values.reduce((total, value) => total + value * value, 0));
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

function normalize(value: number, min: number, max: number): number {
  return clamp((value - min) / (max - min), 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}
