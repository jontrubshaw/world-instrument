import {
  SCORE_OUTPUT_SCHEMA_VERSION,
  SCORE_VERSION_SCHEMA_VERSION,
  STREAM_STATE_SCHEMA_VERSION,
  clamp,
  normalize,
  type NamedParameter,
  type NormalizedStreamState,
  type Score,
  type ScoreInput,
  type ScoreOutput,
  type ScoreVersionMetadata,
  type StreamSample,
} from '@world-instrument/core';

export const WEATHER_PRESSURE_SCORE_ID = 'weather-pressure';
export const WEATHER_PRESSURE_SCORE_VERSION = '1.0.0';

export const weatherPressureMetadata: ScoreVersionMetadata = {
  schemaVersion: SCORE_VERSION_SCHEMA_VERSION,
  scoreId: WEATHER_PRESSURE_SCORE_ID,
  scoreVersion: WEATHER_PRESSURE_SCORE_VERSION,
  displayName: 'Weather Pressure',
  deterministic: true,
  supportedStreamSchemas: [STREAM_STATE_SCHEMA_VERSION],
  description: 'Maps normalized weather into bounded instrument parameters.',
  createdAt: '2026-06-14T19:59:00.000Z',
};

export class WeatherPressureScore implements Score {
  readonly metadata = weatherPressureMetadata;

  evaluate(input: ScoreInput): ScoreOutput {
    const stream = findWeatherStream(input.streams);
    const generatedAt = input.frame.renderedAt ?? stream?.observedAt ?? '1970-01-01T00:00:00.000Z';
    const temperature = findNumericSample(stream, 'temperature')?.value ?? 0;
    const temperatureDelta = findNumericSample(stream, 'temperature')?.delta ?? 0;
    const windSpeed = findNumericSample(stream, 'windSpeed')?.value ?? 0;
    const condition = findCategoricalSample(stream, 'condition')?.value ?? 'unknown';
    const isRaining = findBooleanSample(stream, 'isRaining')?.value ?? false;

    const diffusion = roundScoreValue(
      clamp(normalize(windSpeed, 0, 15) + normalize(Math.abs(temperatureDelta), 0, 3) * 0.1, 0, 1),
    );
    const particleDensity = roundScoreValue(
      clamp(normalize(windSpeed, 0, 10) + (isRaining ? 0.1 : 0), 0, 1),
    );
    const harmonicPressure = roundScoreValue(
      clamp(conditionPressure(condition) + (isRaining ? 0.25 : 0), 0, 1),
    );

    return {
      schemaVersion: SCORE_OUTPUT_SCHEMA_VERSION,
      scoreId: this.metadata.scoreId,
      scoreVersion: this.metadata.scoreVersion,
      frameIndex: input.frame.frameIndex,
      generatedAt,
      visual: {
        palette: paletteForCondition(condition, temperature),
        parameters: [
          boundedParameter('diffusion', diffusion),
          boundedParameter('particleDensity', particleDensity),
        ],
      },
      audio: {
        enabled: true,
        parameters: [boundedParameter('harmonicPressure', harmonicPressure)],
      },
      haptic: {
        enabled: isRaining,
        parameters: isRaining ? [boundedParameter('rainPulse', harmonicPressure)] : [],
      },
      trace: [
        {
          key: 'temperature',
          value: String(temperature),
        },
      ],
    };
  }
}

export const weatherPressureScore = new WeatherPressureScore();

function findWeatherStream(
  streams: readonly NormalizedStreamState[],
): NormalizedStreamState | undefined {
  return (
    streams.find((stream) => stream.source.kind === 'weather') ??
    streams.find((stream) => stream.streamId.startsWith('weather:'))
  );
}

function findNumericSample(
  stream: NormalizedStreamState | undefined,
  key: string,
): Extract<StreamSample, { readonly kind: 'numeric' }> | undefined {
  const sample = stream?.samples.find((entry) => entry.key === key && entry.kind === 'numeric');
  return sample?.kind === 'numeric' ? sample : undefined;
}

function findCategoricalSample(
  stream: NormalizedStreamState | undefined,
  key: string,
): Extract<StreamSample, { readonly kind: 'categorical' }> | undefined {
  const sample = stream?.samples.find((entry) => entry.key === key && entry.kind === 'categorical');
  return sample?.kind === 'categorical' ? sample : undefined;
}

function findBooleanSample(
  stream: NormalizedStreamState | undefined,
  key: string,
): Extract<StreamSample, { readonly kind: 'boolean' }> | undefined {
  const sample = stream?.samples.find((entry) => entry.key === key && entry.kind === 'boolean');
  return sample?.kind === 'boolean' ? sample : undefined;
}

function boundedParameter(key: string, value: number): NamedParameter {
  return {
    key,
    value,
    min: 0,
    max: 1,
  };
}

function conditionPressure(condition: string): number {
  switch (condition.toLowerCase()) {
    case 'clear':
    case 'sunny':
      return 0.1;
    case 'partly-cloudy':
    case 'partly cloudy':
      return 0.2;
    case 'cloudy':
    case 'overcast':
      return 0.3;
    case 'rain':
    case 'raining':
    case 'showers':
      return 0.55;
    case 'storm':
    case 'thunderstorm':
      return 0.8;
    default:
      return 0.25;
  }
}

function paletteForCondition(condition: string, temperature: number): readonly string[] {
  if (condition.toLowerCase().includes('cloud')) {
    return ['#0b1026', '#7fb7ff'];
  }

  if (temperature >= 25) {
    return ['#2a0f12', '#ffb36b'];
  }

  if (temperature <= 0) {
    return ['#06151f', '#bfe9ff'];
  }

  return ['#071f18', '#9ee6a8'];
}

function roundScoreValue(value: number): number {
  return Math.round(value * 100) / 100;
}
