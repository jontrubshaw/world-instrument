import {
  STREAM_STATE_SCHEMA_VERSION,
  type BooleanStreamSample,
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

export const MOCK_SENSOR_ADAPTER_ID = 'sensor.mock-local-device';
export const MOCK_SENSOR_ADAPTER_VERSION = '0.1.0';

export interface MockSensorDevice {
  readonly id: string;
  readonly label: string;
}

export interface RecordedMockSensorPayload {
  readonly provider: 'mock-sensor';
  readonly observedAt: string;
  readonly receivedAt?: string;
  readonly device: MockSensorDevice;
  readonly reading: MockSensorReadingPayload;
}

export interface MockSensorReadingPayload {
  readonly acceleration?: readonly number[];
  readonly orientation?: readonly number[];
  readonly contact?: boolean;
  readonly batteryPercent?: number;
}

export interface MockSensorFixtureAdapterConfig {
  readonly mode: 'fixture';
  readonly fixture: RecordedMockSensorPayload;
  readonly sequence?: number;
  readonly streamId?: string;
  readonly sourceId?: string;
}

export type MockSensorAdapterConfig = MockSensorFixtureAdapterConfig;

export interface NormalizeMockSensorOptions {
  readonly receivedAt?: string;
  readonly sequence?: number;
  readonly sourceId?: string;
  readonly streamId?: string;
}

export class MockSensorAdapter implements StreamAdapter<
  RecordedMockSensorPayload,
  MockSensorAdapterConfig
> {
  readonly id = MOCK_SENSOR_ADAPTER_ID;
  readonly version = MOCK_SENSOR_ADAPTER_VERSION;

  #config: MockSensorAdapterConfig;

  constructor(config: MockSensorAdapterConfig) {
    this.#config = config;
  }

  get source(): StreamSource {
    return createMockSensorSource(this.#config.fixture, this.#config);
  }

  configure(config: MockSensorAdapterConfig): void {
    this.#config = config;
  }

  async read(
    request: StreamReadRequest = {},
  ): Promise<StreamAdapterResult<RecordedMockSensorPayload>> {
    const sequence =
      this.#config.sequence ??
      (request.afterSequence === undefined ? 0 : request.afterSequence + 1);

    return {
      raw: this.#config.fixture,
      state: normalizeMockSensorPayload(this.#config.fixture, {
        sequence,
        ...(this.#config.sourceId === undefined ? {} : { sourceId: this.#config.sourceId }),
        ...(this.#config.streamId === undefined ? {} : { streamId: this.#config.streamId }),
      }),
    };
  }
}

export function normalizeMockSensorPayload(
  payload: RecordedMockSensorPayload,
  options: NormalizeMockSensorOptions = {},
): NormalizedStreamState {
  const observedAt = payload.observedAt;
  const receivedAt = options.receivedAt ?? payload.receivedAt ?? observedAt;

  return {
    schemaVersion: STREAM_STATE_SCHEMA_VERSION,
    streamId: options.streamId ?? `sensor:${payload.device.id}`,
    source: createMockSensorSource(payload, options),
    status: 'ok',
    observedAt,
    receivedAt,
    sequence: options.sequence ?? 0,
    samples: createMockSensorSamples(payload.reading, observedAt),
    metadata: {
      provider: payload.provider,
      mode: 'fixture',
      device: {
        id: payload.device.id,
        label: payload.device.label,
      },
    },
  };
}

function createMockSensorSource(
  payload: RecordedMockSensorPayload,
  options: Pick<NormalizeMockSensorOptions, 'sourceId'>,
): StreamSource {
  return {
    id: options.sourceId ?? `${MOCK_SENSOR_ADAPTER_ID}:${payload.device.id}`,
    kind: 'sensor',
    label: `${payload.device.label} sensor`,
  };
}

function createMockSensorSamples(
  reading: MockSensorReadingPayload,
  observedAt: string,
): readonly StreamSample[] {
  return [
    vectorSample(
      'acceleration',
      'Acceleration',
      reading.acceleration,
      observedAt,
      ['x', 'y', 'z'],
      'm/s2',
    ),
    vectorSample(
      'orientation',
      'Orientation',
      reading.orientation,
      observedAt,
      ['pitch', 'roll', 'yaw'],
      'degrees',
    ),
    booleanSample('contact', 'Contact detected', reading.contact, observedAt),
    numericSample('battery', 'Battery level', reading.batteryPercent, observedAt, 'percent'),
  ];
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

  return {
    kind: 'numeric',
    key,
    label,
    observedAt,
    quality: measured ? 'measured' : 'missing',
    value: measured ? round(value) : 0,
    unit,
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}
