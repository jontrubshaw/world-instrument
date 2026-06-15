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

export const WEATHER_SCORE_V1_ID = 'weather-score';
export const WEATHER_SCORE_V1_VERSION = '1.0.0';

export const WEATHER_SCORE_V1_METADATA: ScoreVersionMetadata = {
  schemaVersion: SCORE_VERSION_SCHEMA_VERSION,
  scoreId: WEATHER_SCORE_V1_ID,
  scoreVersion: WEATHER_SCORE_V1_VERSION,
  displayName: 'Weather Score v1',
  deterministic: true,
  supportedStreamSchemas: [STREAM_STATE_SCHEMA_VERSION],
  description: 'Maps normalized weather streams into abstract visual, audio, and haptic controls.',
  createdAt: '2026-06-14T22:00:00.000Z',
  metadata: {
    inputKind: 'weather',
    outputSurface: 'abstract-instrument',
  },
};

export class WeatherScoreV1 implements Score {
  readonly metadata = WEATHER_SCORE_V1_METADATA;

  evaluate(input: ScoreInput): ScoreOutput {
    const weather = selectWeatherStream(input.streams);

    if (weather === undefined) {
      const sensor = selectSensorStream(input.streams);

      if (sensor !== undefined) {
        return evaluateSensorScore(this.metadata, input, sensor);
      }
    }

    const metrics = extractWeatherMetrics(weather);
    const normalized = normalizeWeatherMetrics(metrics);
    const generatedAt = input.frame.renderedAt ?? weather?.observedAt ?? '1970-01-01T00:00:00.000Z';

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
          parameter('grain', clamp(normalized.precipitation * 0.7 + normalized.wind * 0.3, 0, 1)),
          parameter('tempo', clamp(0.2 + normalized.motion * 0.8, 0, 1)),
        ],
      },
      haptic: {
        enabled: metrics.isRaining || normalized.wind > 0.7,
        parameters: [
          parameter(
            'pulseIntensity',
            clamp(normalized.precipitation * 0.65 + normalized.wind * 0.35, 0, 1),
          ),
        ],
      },
      trace: [
        {
          key: 'inputHash',
          value: hashJson({
            seed: input.seed,
            frameIndex: input.frame.frameIndex,
            streamId: weather?.streamId ?? 'missing',
            sequence: weather?.sequence ?? -1,
            observedAt: weather?.observedAt ?? 'missing',
            condition: metrics.condition,
            temperature: metrics.temperature,
            windSpeed: metrics.windSpeed,
            precipitation: metrics.precipitation,
          }),
        },
        {
          key: 'condition',
          value: metrics.condition,
        },
      ],
      metadata: {
        streamStatus: weather?.status ?? 'missing',
        streamId: weather?.streamId ?? 'missing',
        condition: metrics.condition,
      },
    };
  }
}

export const weatherScoreV1 = new WeatherScoreV1();

interface WeatherMetrics {
  readonly temperature: number;
  readonly humidity: number;
  readonly windSpeed: number;
  readonly precipitation: number;
  readonly pressure: number;
  readonly cloudCover: number;
  readonly condition: string;
  readonly isRaining: boolean;
}

interface NormalizedWeatherMetrics {
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

function selectWeatherStream(
  streams: readonly NormalizedStreamState[],
): NormalizedStreamState | undefined {
  return (
    streams.find((stream) => stream.source.kind === 'weather') ??
    streams.find((stream) => stream.streamId.startsWith('weather:'))
  );
}

function selectSensorStream(
  streams: readonly NormalizedStreamState[],
): NormalizedStreamState | undefined {
  return (
    streams.find((stream) => stream.source.kind === 'sensor') ??
    streams.find((stream) => stream.streamId.startsWith('sensor:'))
  );
}

function evaluateSensorScore(
  metadata: ScoreVersionMetadata,
  input: ScoreInput,
  sensor: NormalizedStreamState,
): ScoreOutput {
  const metrics = extractSensorMetrics(sensor);
  const normalized = normalizeSensorMetrics(metrics);
  const generatedAt = input.frame.renderedAt ?? sensor.observedAt;
  const hapticsAvailable = sensor.status !== 'stale';
  const hapticPulseIntensity = hapticsAvailable
    ? clamp(
        normalized.motion * 0.55 + normalized.precipitation * 0.35 + normalized.tension * 0.1,
        0,
        1,
      )
    : 0;

  return {
    schemaVersion: SCORE_OUTPUT_SCHEMA_VERSION,
    scoreId: metadata.scoreId,
    scoreVersion: metadata.scoreVersion,
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
      parameters: [
        parameter('pulseIntensity', hapticPulseIntensity),
      ],
    },
    trace: [
      {
        key: 'inputHash',
        value: hashJson({
          seed: input.seed,
          frameIndex: input.frame.frameIndex,
          streamId: sensor.streamId,
          sequence: sensor.sequence,
          observedAt: sensor.observedAt,
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
      streamStatus: sensor.status,
      streamId: sensor.streamId,
      condition: metrics.condition,
      inputKind: 'sensor',
    },
  };
}

function extractWeatherMetrics(stream: NormalizedStreamState | undefined): WeatherMetrics {
  const samples = stream?.samples ?? [];

  return {
    temperature: numericSampleValue(samples, 'temperature', 0),
    humidity: numericSampleValue(samples, 'relativeHumidity', 0),
    windSpeed: numericSampleValue(samples, 'windSpeed', 0),
    precipitation: numericSampleValue(samples, 'precipitation', 0),
    pressure: numericSampleValue(samples, 'pressure', 1013.25),
    cloudCover: numericSampleValue(samples, 'cloudCover', 0),
    condition: categoricalSampleValue(samples, 'condition', 'unknown'),
    isRaining: booleanSampleValue(samples, 'isRaining', false),
  };
}

function extractSensorMetrics(stream: NormalizedStreamState): SensorMetrics {
  const samples = stream.samples;
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

function normalizeWeatherMetrics(metrics: WeatherMetrics): NormalizedWeatherMetrics {
  const warmth = normalize(metrics.temperature, -20, 45);
  const humidity = normalize(metrics.humidity, 0, 100);
  const wind = normalize(metrics.windSpeed, 0, 30);
  const precipitation = normalize(metrics.precipitation, 0, 20);
  const pressure = normalize(metrics.pressure, 960, 1045);
  const cloudCover = normalize(metrics.cloudCover, 0, 100);
  const motion = clamp(wind * 0.65 + precipitation * 0.35, 0, 1);
  const diffusion = clamp(0.2 + humidity * 0.25 + cloudCover * 0.35 + precipitation * 0.2, 0, 1);
  const tension = clamp((1 - pressure) * 0.4 + wind * 0.35 + precipitation * 0.25, 0, 1);
  const brightness = clamp(
    0.25 + warmth * 0.35 + (1 - cloudCover) * 0.3 - precipitation * 0.15,
    0,
    1,
  );

  return {
    warmth: round(warmth),
    humidity: round(humidity),
    wind: round(wind),
    precipitation: round(precipitation),
    pressure: round(pressure),
    cloudCover: round(cloudCover),
    motion: round(motion),
    diffusion: round(diffusion),
    tension: round(tension),
    brightness: round(brightness),
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
  readonly stream: NormalizedStreamState;
  readonly interactionActive: boolean;
  readonly pointerPressure: number;
  readonly pointerSpeed: number;
  readonly motionIntensity: number;
  readonly accelerationMagnitude: number;
  readonly rotationMagnitude: number;
}): string {
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
    case 'clear':
      return ['#08111f', '#f8d56b', '#76d7ff'];
    case 'partly-cloudy':
    case 'overcast':
      return ['#0b1026', '#7fb7ff', '#d8b4fe'];
    case 'rain':
      return ['#061923', '#38bdf8', '#22d3ee'];
    case 'snow':
      return ['#09111f', '#dbeafe', '#93c5fd'];
    case 'storm':
      return ['#090716', '#a78bfa', '#facc15'];
    case 'fog':
      return ['#111827', '#cbd5e1', '#94a3b8'];
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
