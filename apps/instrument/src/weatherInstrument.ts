import { SCORE_INPUT_SCHEMA_VERSION, type ScoreOutput } from '@world-instrument/core';
import { WeatherAdapter, type RecordedWeatherPayload } from '@world-instrument/adapters';
import { weatherScoreV1 } from '@world-instrument/scores';

import londonWeatherFixture from './fixtures/open-meteo-london-current.v1.json';

export interface InstrumentSceneParameters {
  readonly palette: {
    readonly background: string;
    readonly body: string;
    readonly accent: string;
  };
  readonly condition: string;
  readonly streamStatus: string;
  readonly inputHash: string;
  readonly bodyScale: number;
  readonly pulseAmplitude: number;
  readonly pulseRate: number;
  readonly rotationRate: {
    readonly x: number;
    readonly y: number;
    readonly inner: number;
  };
  readonly wireOpacity: number;
  readonly innerOpacity: number;
  readonly innerScale: number;
  readonly emissiveIntensity: number;
  readonly roughness: number;
  readonly metalness: number;
  readonly keyLightIntensity: number;
  readonly fillLightIntensity: number;
  readonly fog: {
    readonly near: number;
    readonly far: number;
  };
}

export interface WeatherInstrumentState {
  readonly label: string;
  readonly observedAt: string;
  readonly score: ScoreOutput;
  readonly visual: InstrumentSceneParameters;
}

export const DEFAULT_INSTRUMENT_SCENE: InstrumentSceneParameters = {
  palette: {
    background: '#050716',
    body: '#6ee7f9',
    accent: '#f0abfc',
  },
  condition: 'loading',
  streamStatus: 'loading',
  inputHash: 'pending',
  bodyScale: 1.08,
  pulseAmplitude: 0.05,
  pulseRate: 1.45,
  rotationRate: {
    x: 0.18,
    y: 0.26,
    inner: 0.42,
  },
  wireOpacity: 0.2,
  innerOpacity: 0.42,
  innerScale: 1.24,
  emissiveIntensity: 0.72,
  roughness: 0.28,
  metalness: 0.34,
  keyLightIntensity: 4.8,
  fillLightIntensity: 2.2,
  fog: {
    near: 4,
    far: 9,
  },
};

export async function loadWeatherInstrumentState(): Promise<WeatherInstrumentState> {
  const fixture = londonWeatherFixture as RecordedWeatherPayload;
  const adapter = new WeatherAdapter({
    mode: 'fixture',
    fixture,
    sequence: 0,
  });
  const result = await adapter.read();
  const score = weatherScoreV1.evaluate({
    schemaVersion: SCORE_INPUT_SCHEMA_VERSION,
    score: weatherScoreV1.metadata,
    frame: {
      frameIndex: 0,
      elapsedMs: 0,
      renderedAt: result.state.observedAt,
    },
    streams: [result.state],
    seed: 'weather-score-v1:london:0',
  });

  return {
    label: result.state.source.label ?? result.state.source.id,
    observedAt: result.state.observedAt,
    score,
    visual: mapWeatherScoreToInstrumentScene(score),
  };
}

export function mapWeatherScoreToInstrumentScene(score: ScoreOutput): InstrumentSceneParameters {
  const warmth = parameterValue(score, 'warmth');
  const humidity = parameterValue(score, 'humidity');
  const wind = parameterValue(score, 'wind');
  const precipitation = parameterValue(score, 'precipitation');
  const pressure = parameterValue(score, 'pressure');
  const cloudCover = parameterValue(score, 'cloudCover');
  const motion = parameterValue(score, 'motion');
  const diffusion = parameterValue(score, 'diffusion');
  const tension = parameterValue(score, 'tension');
  const brightness = parameterValue(score, 'brightness');
  const [background, body, accent] = normalizePalette(score.visual.palette);

  return {
    palette: {
      background,
      body,
      accent,
    },
    condition: metadataString(score, 'condition', 'unknown'),
    streamStatus: metadataString(score, 'streamStatus', 'missing'),
    inputHash: traceValue(score, 'inputHash', 'missing'),
    bodyScale: round(1 + warmth * 0.18 + pressure * 0.08),
    pulseAmplitude: round(0.035 + motion * 0.18 + precipitation * 0.09),
    pulseRate: round(0.9 + motion * 3 + wind * 1.2),
    rotationRate: {
      x: round(0.12 + wind * 0.42),
      y: round(0.18 + motion * 0.68),
      inner: round(0.24 + tension * 0.76),
    },
    wireOpacity: round(0.1 + cloudCover * 0.25),
    innerOpacity: round(0.22 + brightness * 0.5),
    innerScale: round(1 + diffusion * 0.45),
    emissiveIntensity: round(0.38 + brightness * 0.75 + warmth * 0.15),
    roughness: round(0.18 + diffusion * 0.48),
    metalness: round(0.22 + pressure * 0.25),
    keyLightIntensity: round(3.2 + brightness * 3.1),
    fillLightIntensity: round(1.2 + humidity * 2 + precipitation * 3),
    fog: {
      near: round(3.4 - diffusion * 0.9),
      far: round(7.2 + brightness * 2 - diffusion * 0.8),
    },
  };
}

function parameterValue(score: ScoreOutput, key: string): number {
  return score.visual.parameters.find((parameter) => parameter.key === key)?.value ?? 0;
}

function normalizePalette(palette: readonly string[] | undefined): [string, string, string] {
  return [
    palette?.[0] ?? DEFAULT_INSTRUMENT_SCENE.palette.background,
    palette?.[1] ?? DEFAULT_INSTRUMENT_SCENE.palette.body,
    palette?.[2] ?? DEFAULT_INSTRUMENT_SCENE.palette.accent,
  ];
}

function metadataString(score: ScoreOutput, key: string, fallback: string): string {
  const value = score.metadata?.[key];

  return typeof value === 'string' ? value : fallback;
}

function traceValue(score: ScoreOutput, key: string, fallback: string): string {
  return score.trace?.find((entry) => entry.key === key)?.value ?? fallback;
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}
