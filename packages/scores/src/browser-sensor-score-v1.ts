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

export const BROWSER_SENSOR_SCORE_V1_ID = 'browser-sensor-score';
export const BROWSER_SENSOR_SCORE_V1_VERSION = '1.0.0';

export const BROWSER_SENSOR_SCORE_V1_METADATA: ScoreVersionMetadata = {
  schemaVersion: SCORE_VERSION_SCHEMA_VERSION,
  scoreId: BROWSER_SENSOR_SCORE_V1_ID,
  scoreVersion: BROWSER_SENSOR_SCORE_V1_VERSION,
  displayName: 'Browser Sensor Score v1',
  deterministic: true,
  supportedStreamSchemas: [STREAM_STATE_SCHEMA_VERSION],
  description:
    'Maps normalized browser sensor and interaction streams into abstract visual, audio, and haptic controls.',
  createdAt: '2026-06-15T22:45:00.000Z',
  metadata: {
    inputKind: 'browser-sensor',
    outputSurface: 'abstract-instrument',
  },
};

export class BrowserSensorScoreV1 implements Score {
  readonly metadata = BROWSER_SENSOR_SCORE_V1_METADATA;

  evaluate(input: ScoreInput): ScoreOutput {
    const sensor = selectSensorStream(input.streams);
    const metrics = extractSensorMetrics(sensor);
    const normalized = normalizeSensorMetrics(metrics);
    const generatedAt = input.frame.renderedAt ?? sensor?.observedAt ?? '1970-01-01T00:00:00.000Z';
    const hapticsAvailable = sensor !== undefined && sensor.status !== 'stale';
    const hapticPulseIntensity = hapticsAvailable
      ? clamp(
          normalized.motion * 0.55 + normalized.precipitation * 0.35 + normalized.tension * 0.1,
          0,
          1,
        )
      : 0;

    return {
      schemaVersion: SCORE_OUTPUT_SCHEMA_VERSION,
      scoreId: this.metadata.scoreId,
      scoreVersion: this.metadata.scoreVersion,
      frameIndex: input.frame.frameIndex,
      generatedAt,
      visual: {
        palette: paletteForCondition(metrics.condition),
        parameters: [
          parameter('warmth', normalized.warmth),
          parameter('humidity', normalized.humidity),
          parameter('wind', normalized.wind),
          parameter('precipitation', normalized.precipitation),
          parameter('pressure', normalized.pressure),
          parameter('cloudCover', normalized.cloudCover),
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
          parameter('grain', clamp(normalized.precipitation * 0.55 + normalized.wind * 0.45, 0, 1)),
          parameter('tempo', clamp(0.18 + normalized.motion * 0.82, 0, 1)),
        ],
      },
      haptic: {
        enabled: hapticsAvailable && (metrics.interactionActive || normalized.motion > 0.55),
        parameters: [parameter('pulseIntensity', hapticPulseIntensity)],
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
            condition: metrics.condition,
            pointerX: metrics.pointerX,
            pointerY: metrics.pointerY,
            motionIntensity: metrics.motionIntensity,
          }),
        },
        {
          key: 'condition',
          value: metrics.condition,
        },
      ],
      metadata: {
        streamStatus: sensor?.status ?? 'missing',
        streamId: sensor?.streamId ?? 'missing',
        condition: metrics.condition,
        inputKind: 'browser-sensor',
      },
    };
  }
}

export const browserSensorScoreV1 = new BrowserSensorScoreV1();

interface SensorMetrics {
  readonly pointerX: number;
  readonly pointerY: number;
  readonly pointerVelocity: number;
  readonly pointerPressure: number;
  readonly interactionActive: boolean;
  readonly accelerationMagnitude: number;
  readonly rotationMagnitude: number;
  readonly orientationTilt: number;
  readonly motionIntensity: number;
  readonly condition: string;
}

interface NormalizedSensorMetrics {
  readonly warmth: number;
  readonly humidity: number;
  readonly wind: number;
  readonly precipitation: number;
  readonly pressure: number;
  readonly cloudCover: number;
  readonly motion: number;
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
  const pointerPosition = vectorSampleValue(samples, 'pointerPosition', [0.5, 0.5]);
  const pointerVelocity = vectorSampleValue(samples, 'pointerVelocity', [0, 0]);
  const acceleration = vectorSampleValue(samples, 'acceleration', [0, 0, 0]);
  const rotationRate = vectorSampleValue(samples, 'rotationRate', [0, 0, 0]);
  const orientation = vectorSampleValue(samples, 'orientation', [0, 0, 0]);
  const motionIntensity = numericSampleValue(samples, 'motionIntensity', 0);
  const pointerPressure = numericSampleValue(samples, 'pointerPressure', 0);
  const interactionActive = booleanSampleValue(samples, 'interactionActive', false);
  const pointerSpeed = vectorMagnitude(pointerVelocity);
  const accelerationMagnitude = vectorMagnitude(acceleration);
  const rotationMagnitude = vectorMagnitude(rotationRate);
  const orientationTilt = Math.min(
    Math.abs(orientation[1] ?? 0) + Math.abs(orientation[2] ?? 0),
    90,
  );

  return {
    pointerX: clamp(pointerPosition[0] ?? 0.5, 0, 1),
    pointerY: clamp(pointerPosition[1] ?? 0.5, 0, 1),
    pointerVelocity: pointerSpeed,
    pointerPressure: clamp(pointerPressure, 0, 1),
    interactionActive,
    accelerationMagnitude,
    rotationMagnitude,
    orientationTilt,
    motionIntensity: clamp(motionIntensity, 0, 1),
    condition: sensorCondition({
      stream,
      interactionActive,
      pointerPressure,
      pointerSpeed,
      motionIntensity,
      accelerationMagnitude,
      rotationMagnitude,
    }),
  };
}

function normalizeSensorMetrics(metrics: SensorMetrics): NormalizedSensorMetrics {
  const motion = clamp(
    metrics.motionIntensity * 0.55 +
      normalize(metrics.pointerVelocity, 0, 0.35) * 0.25 +
      normalize(metrics.rotationMagnitude, 0, 180) * 0.2,
    0,
    1,
  );
  const pressure = clamp(
    0.45 + metrics.pointerPressure * 0.4 - normalize(metrics.orientationTilt, 0, 90) * 0.15,
    0,
    1,
  );
  const cloudCover = clamp(
    0.18 + normalize(metrics.orientationTilt, 0, 90) * 0.52 + metrics.pointerY * 0.18,
    0,
    1,
  );
  const precipitation = clamp(
    metrics.pointerPressure * 0.45 +
      (metrics.interactionActive ? 0.25 : 0) +
      normalize(metrics.accelerationMagnitude, 0, 8) * 0.3,
    0,
    1,
  );
  const tension = clamp(
    motion * 0.42 +
      metrics.pointerPressure * 0.28 +
      normalize(metrics.orientationTilt, 0, 90) * 0.3,
    0,
    1,
  );
  const brightness = clamp(
    0.22 + metrics.pointerX * 0.42 + (1 - metrics.pointerY) * 0.22 + motion * 0.14,
    0,
    1,
  );

  return {
    warmth: round(metrics.pointerX),
    humidity: round(1 - metrics.pointerY),
    wind: round(clamp(motion * 0.72 + normalize(metrics.rotationMagnitude, 0, 180) * 0.28, 0, 1)),
    precipitation: round(precipitation),
    pressure: round(pressure),
    cloudCover: round(cloudCover),
    motion: round(motion),
    diffusion: round(
      clamp(0.2 + metrics.pointerY * 0.3 + cloudCover * 0.35 + precipitation * 0.15, 0, 1),
    ),
    tension: round(tension),
    brightness: round(brightness),
  };
}

function numericSampleValue(
  samples: readonly StreamSample[],
  key: string,
  fallback: number,
): number {
  const sample = samples.find((entry) => entry.kind === 'numeric' && entry.key === key);

  return sample?.kind === 'numeric' && sample.quality !== 'missing' ? sample.value : fallback;
}

function booleanSampleValue(
  samples: readonly StreamSample[],
  key: string,
  fallback: boolean,
): boolean {
  const sample = samples.find((entry) => entry.kind === 'boolean' && entry.key === key);

  return sample?.kind === 'boolean' && sample.quality !== 'missing' ? sample.value : fallback;
}

function vectorSampleValue(
  samples: readonly StreamSample[],
  key: string,
  fallback: readonly number[],
): readonly number[] {
  const sample = samples.find((entry) => entry.kind === 'vector' && entry.key === key);

  return sample?.kind === 'vector' && sample.quality !== 'missing' ? sample.values : fallback;
}

function vectorMagnitude(values: readonly number[]): number {
  return Math.sqrt(values.reduce((total, value) => total + value * value, 0));
}

function sensorCondition(options: {
  readonly stream: NormalizedStreamState | undefined;
  readonly interactionActive: boolean;
  readonly pointerPressure: number;
  readonly pointerSpeed: number;
  readonly motionIntensity: number;
  readonly accelerationMagnitude: number;
  readonly rotationMagnitude: number;
}): string {
  if (options.stream === undefined) {
    return 'sensor-missing';
  }

  if (options.stream.status === 'stale') {
    return 'sensor-stale';
  }

  if (
    options.motionIntensity > 0.62 ||
    options.accelerationMagnitude > 4 ||
    options.rotationMagnitude > 90
  ) {
    return 'sensor-motion';
  }

  if (options.interactionActive || options.pointerPressure > 0.25) {
    return 'sensor-touch';
  }

  if (options.pointerSpeed > 0.02) {
    return 'sensor-pointer';
  }

  return options.stream.status === 'degraded' ? 'sensor-fallback' : 'sensor-still';
}

function paletteForCondition(condition: string): readonly string[] {
  switch (condition) {
    case 'sensor-motion':
      return ['#070513', '#fb7185', '#22d3ee'];
    case 'sensor-touch':
      return ['#0d0618', '#f0abfc', '#facc15'];
    case 'sensor-pointer':
      return ['#04111d', '#2dd4bf', '#a7f3d0'];
    case 'sensor-fallback':
    case 'sensor-stale':
      return ['#101827', '#94a3b8', '#c4b5fd'];
    case 'sensor-still':
      return ['#06111f', '#60a5fa', '#c084fc'];
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
