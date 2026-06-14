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

function selectWeatherStream(
  streams: readonly NormalizedStreamState[],
): NormalizedStreamState | undefined {
  return (
    streams.find((stream) => stream.source.kind === 'weather') ??
    streams.find((stream) => stream.streamId.startsWith('weather:'))
  );
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
