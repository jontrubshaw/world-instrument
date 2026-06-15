import {
  SCORE_OUTPUT_SCHEMA_VERSION,
  SCORE_VERSION_SCHEMA_VERSION,
  STREAM_STATE_SCHEMA_VERSION,
  clamp,
  hashJson,
  normalize,
  type NamedParameter,
  type NormalizedStreamState,
  type Score,
  type ScoreInput,
  type ScoreOutput,
  type ScoreVersionMetadata,
  type StreamSample,
} from '@world-instrument/core';

export const SENSOR_SCORE_V1_ID = 'sensor-score';
export const SENSOR_SCORE_V1_VERSION = '1.0.0';

export const SENSOR_SCORE_V1_METADATA: ScoreVersionMetadata = {
  schemaVersion: SCORE_VERSION_SCHEMA_VERSION,
  scoreId: SENSOR_SCORE_V1_ID,
  scoreVersion: SENSOR_SCORE_V1_VERSION,
  displayName: 'Sensor Score v1',
  deterministic: true,
  supportedStreamSchemas: [STREAM_STATE_SCHEMA_VERSION],
  description:
    'Maps normalized browser pointer, motion, and orientation streams into abstract visual, audio, and haptic controls.',
  createdAt: '2026-06-15T14:40:00.000Z',
  metadata: {
    inputKind: 'sensor',
    outputSurface: 'abstract-instrument',
  },
};

export class SensorScoreV1 implements Score {
  readonly metadata = SENSOR_SCORE_V1_METADATA;

  evaluate(input: ScoreInput): ScoreOutput {
    const sensor = selectSensorStream(input.streams);
    const metrics = extractSensorMetrics(sensor);
    const normalized = normalizeSensorMetrics(metrics);
    const condition = conditionForMetrics(metrics);
    const generatedAt = input.frame.renderedAt ?? sensor?.observedAt ?? '1970-01-01T00:00:00.000Z';

    return {
      schemaVersion: SCORE_OUTPUT_SCHEMA_VERSION,
      scoreId: this.metadata.scoreId,
      scoreVersion: this.metadata.scoreVersion,
      frameIndex: input.frame.frameIndex,
      generatedAt,
      visual: {
        palette: paletteForCondition(condition),
        parameters: [
          parameter('warmth', normalized.x),
          parameter('humidity', normalized.y),
          parameter('wind', normalized.motion),
          parameter('precipitation', normalized.pressure),
          parameter('pressure', normalized.tilt),
          parameter('cloudCover', normalized.fallback),
          parameter('motion', normalized.motion),
          parameter('diffusion', normalized.diffusion),
          parameter('tension', normalized.tension),
          parameter('brightness', normalized.brightness),
        ],
      },
      audio: {
        enabled: true,
        parameters: [
          parameter('harmonicPressure', normalized.tension),
          parameter(
            'grain',
            clamp(
              normalized.fallback * 0.35 + normalized.pressure * 0.4 + normalized.motion * 0.25,
              0,
              1,
            ),
          ),
          parameter(
            'tempo',
            clamp(0.15 + normalized.motion * 0.75 + normalized.active * 0.1, 0, 1),
          ),
        ],
      },
      haptic: {
        enabled: metrics.active || normalized.motion > 0.42 || normalized.pressure > 0.35,
        parameters: [
          parameter(
            'pulseIntensity',
            clamp(
              normalized.motion * 0.55 + normalized.pressure * 0.35 + normalized.active * 0.1,
              0,
              1,
            ),
          ),
        ],
      },
      trace: [
        {
          key: 'inputHash',
          value: hashJson({
            seed: input.seed,
            frameIndex: input.frame.frameIndex,
            streamId: sensor?.streamId ?? 'missing',
            sequence: sensor?.sequence ?? -1,
            observedAt: sensor?.observedAt ?? 'missing',
            pointer: metrics.pointerPosition,
            delta: metrics.pointerDelta,
            motion: metrics.motion,
            orientation: metrics.orientation,
            capability: metrics.capability,
          }),
        },
        {
          key: 'condition',
          value: condition,
        },
      ],
      metadata: {
        streamStatus: sensor?.status ?? 'missing',
        streamId: sensor?.streamId ?? 'missing',
        condition,
        capability: metrics.capability,
      },
    };
  }
}

export const sensorScoreV1 = new SensorScoreV1();

interface SensorMetrics {
  readonly pointerPosition: readonly [number, number];
  readonly pointerDelta: readonly [number, number];
  readonly pointerPressure: number;
  readonly motion: readonly [number, number, number];
  readonly rotationRate: readonly [number, number, number];
  readonly orientation: readonly [number, number, number];
  readonly active: boolean;
  readonly fallbackActive: boolean;
  readonly capability: string;
}

interface NormalizedSensorMetrics {
  readonly x: number;
  readonly y: number;
  readonly pressure: number;
  readonly active: number;
  readonly fallback: number;
  readonly motion: number;
  readonly tilt: number;
  readonly diffusion: number;
  readonly tension: number;
  readonly brightness: number;
}

function selectSensorStream(
  streams: readonly NormalizedStreamState[],
): NormalizedStreamState | undefined {
  return (
    streams.find((stream) => stream.source.kind === 'sensor') ??
    streams.find((stream) => stream.streamId.startsWith('sensor:'))
  );
}

function extractSensorMetrics(stream: NormalizedStreamState | undefined): SensorMetrics {
  const samples = stream?.samples ?? [];

  return {
    pointerPosition: vectorSampleValue(samples, 'pointerPosition', [0.5, 0.5], 2),
    pointerDelta: vectorSampleValue(samples, 'pointerDelta', [0, 0], 2),
    pointerPressure: numericSampleValue(samples, 'pointerPressure', 0),
    motion: vectorSampleValue(samples, 'motion', [0, 0, 0], 3),
    rotationRate: vectorSampleValue(samples, 'rotationRate', [0, 0, 0], 3),
    orientation: vectorSampleValue(samples, 'orientation', [0, 0, 0], 3),
    active: booleanSampleValue(samples, 'interactionActive', false),
    fallbackActive: booleanSampleValue(samples, 'fallbackActive', true),
    capability: categoricalSampleValue(samples, 'sensorCapability', 'idle-pointer'),
  };
}

function normalizeSensorMetrics(metrics: SensorMetrics): NormalizedSensorMetrics {
  const [x, y] = metrics.pointerPosition;
  const [deltaX, deltaY] = metrics.pointerDelta;
  const [, beta, gamma] = metrics.orientation;
  const deltaMagnitude = clamp(Math.hypot(deltaX, deltaY) * 8, 0, 1);
  const motionMagnitude = normalize(Math.hypot(...metrics.motion), 0, 18);
  const rotationMagnitude = normalize(Math.hypot(...metrics.rotationRate), 0, 240);
  const tilt = normalize(Math.abs(beta) + Math.abs(gamma), 0, 180);
  const active = metrics.active ? 1 : 0;
  const fallback = metrics.fallbackActive ? 0.72 : 0.15;
  const pressure = clamp(metrics.pointerPressure, 0, 1);
  const motion = clamp(
    deltaMagnitude * 0.46 + motionMagnitude * 0.32 + rotationMagnitude * 0.14 + active * 0.08,
    0,
    1,
  );
  const tension = clamp(tilt * 0.45 + motion * 0.35 + pressure * 0.2, 0, 1);
  const diffusion = clamp(
    0.2 + fallback * 0.28 + (1 - motion) * 0.18 + y * 0.22 + pressure * 0.12,
    0,
    1,
  );
  const brightness = clamp(0.22 + (1 - y) * 0.35 + x * 0.18 + pressure * 0.2 + active * 0.08, 0, 1);

  return {
    x: round(clamp(x, 0, 1)),
    y: round(clamp(y, 0, 1)),
    pressure: round(pressure),
    active: round(active),
    fallback: round(fallback),
    motion: round(motion),
    tilt: round(tilt),
    diffusion: round(diffusion),
    tension: round(tension),
    brightness: round(brightness),
  };
}

function vectorSampleValue<TLength extends 2 | 3>(
  samples: readonly StreamSample[],
  key: string,
  fallback: TLength extends 2 ? readonly [number, number] : readonly [number, number, number],
  length: TLength,
): TLength extends 2 ? readonly [number, number] : readonly [number, number, number] {
  const sample = samples.find((entry) => entry.kind === 'vector' && entry.key === key);

  if (sample?.kind !== 'vector' || sample.quality === 'missing' || sample.values.length < length) {
    return fallback;
  }

  return sample.values.slice(0, length) as TLength extends 2
    ? readonly [number, number]
    : readonly [number, number, number];
}

function numericSampleValue(
  samples: readonly StreamSample[],
  key: string,
  fallback: number,
): number {
  const sample = samples.find((entry) => entry.kind === 'numeric' && entry.key === key);

  return sample?.kind === 'numeric' && sample.quality !== 'missing' ? sample.value : fallback;
}

function categoricalSampleValue(
  samples: readonly StreamSample[],
  key: string,
  fallback: string,
): string {
  const sample = samples.find((entry) => entry.kind === 'categorical' && entry.key === key);

  return sample?.kind === 'categorical' && sample.quality !== 'missing' ? sample.value : fallback;
}

function booleanSampleValue(
  samples: readonly StreamSample[],
  key: string,
  fallback: boolean,
): boolean {
  const sample = samples.find((entry) => entry.kind === 'boolean' && entry.key === key);

  return sample?.kind === 'boolean' && sample.quality !== 'missing' ? sample.value : fallback;
}

function conditionForMetrics(metrics: SensorMetrics): string {
  if (metrics.capability === 'device-sensor') {
    return metrics.active ? 'sensor-motion-active' : 'sensor-motion';
  }

  if (metrics.capability === 'pointer') {
    return metrics.active ? 'sensor-pointer-active' : 'sensor-pointer';
  }

  if (metrics.capability === 'unavailable') {
    return 'sensor-unavailable';
  }

  return 'sensor-idle';
}

function paletteForCondition(condition: string): readonly string[] {
  switch (condition) {
    case 'sensor-motion-active':
      return ['#07111f', '#34d399', '#f97316'];
    case 'sensor-motion':
      return ['#06141c', '#22d3ee', '#a7f3d0'];
    case 'sensor-pointer-active':
      return ['#0c0a1d', '#f0abfc', '#38bdf8'];
    case 'sensor-pointer':
      return ['#080f1f', '#93c5fd', '#c084fc'];
    case 'sensor-unavailable':
      return ['#111827', '#64748b', '#cbd5e1'];
    default:
      return ['#050716', '#6ee7f9', '#f0abfc'];
  }
}

function parameter(key: string, value: number): NamedParameter {
  return {
    key,
    value: round(clamp(value, 0, 1)),
    min: 0,
    max: 1,
  };
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}
