import type { ScoreOutput, VisualOutputState } from '@world-instrument/core';

export interface InstrumentVisualParameters {
  readonly scoreId: string;
  readonly scoreVersion: string;
  readonly frameIndex: number;
  readonly generatedAt: string;
  readonly condition: string;
  readonly signature: string;
  readonly backgroundColor: string;
  readonly bodyColor: string;
  readonly accentColor: string;
  readonly innerColor: string;
  readonly emissiveColor: string;
  readonly bodyScale: number;
  readonly innerScale: number;
  readonly rotationSpeedX: number;
  readonly rotationSpeedY: number;
  readonly innerRotationSpeed: number;
  readonly pulseAmplitude: number;
  readonly pulseRate: number;
  readonly wireOpacity: number;
  readonly innerOpacity: number;
  readonly emissiveIntensity: number;
  readonly keyLightIntensity: number;
  readonly fillLightIntensity: number;
  readonly ambientIntensity: number;
  readonly fogNear: number;
  readonly fogFar: number;
  readonly glowOpacity: number;
  readonly tensionTilt: number;
}

export const DEFAULT_VISUAL_PARAMETERS: InstrumentVisualParameters = {
  scoreId: 'weather-score',
  scoreVersion: '1.0.0',
  frameIndex: 0,
  generatedAt: '1970-01-01T00:00:00.000Z',
  condition: 'tuning',
  signature: 'loading',
  backgroundColor: '#050716',
  bodyColor: '#6ee7f9',
  accentColor: '#f0abfc',
  innerColor: '#ffffff',
  emissiveColor: '#162759',
  bodyScale: 1.08,
  innerScale: 1.16,
  rotationSpeedX: 0.2,
  rotationSpeedY: 0.34,
  innerRotationSpeed: 0.5,
  pulseAmplitude: 0.08,
  pulseRate: 1.7,
  wireOpacity: 0.18,
  innerOpacity: 0.42,
  emissiveIntensity: 0.72,
  keyLightIntensity: 4.8,
  fillLightIntensity: 2.2,
  ambientIntensity: 0.82,
  fogNear: 4,
  fogFar: 9,
  glowOpacity: 0.18,
  tensionTilt: 0,
};

export function mapScoreOutputToVisualParameters(output: ScoreOutput): InstrumentVisualParameters {
  const visual = output.visual;
  const warmth = parameterValue(visual, 'warmth');
  const humidity = parameterValue(visual, 'humidity');
  const wind = parameterValue(visual, 'wind');
  const precipitation = parameterValue(visual, 'precipitation');
  const cloudCover = parameterValue(visual, 'cloudCover');
  const motion = parameterValue(visual, 'motion');
  const diffusion = parameterValue(visual, 'diffusion');
  const tension = parameterValue(visual, 'tension');
  const brightness = parameterValue(visual, 'brightness');

  return {
    scoreId: output.scoreId,
    scoreVersion: output.scoreVersion,
    frameIndex: output.frameIndex,
    generatedAt: output.generatedAt,
    condition: metadataString(output.metadata?.condition, 'unknown'),
    signature: traceValue(output, 'inputHash') ?? `${output.scoreId}:${String(output.frameIndex)}`,
    backgroundColor: paletteColor(visual, 0, DEFAULT_VISUAL_PARAMETERS.backgroundColor),
    bodyColor: paletteColor(visual, 1, DEFAULT_VISUAL_PARAMETERS.bodyColor),
    accentColor: paletteColor(visual, 2, DEFAULT_VISUAL_PARAMETERS.accentColor),
    innerColor: '#ffffff',
    emissiveColor: paletteColor(visual, 1, DEFAULT_VISUAL_PARAMETERS.emissiveColor),
    bodyScale: round(1.02 + warmth * 0.18 - cloudCover * 0.05),
    innerScale: round(1.08 + diffusion * 0.24 + tension * 0.08),
    rotationSpeedX: round(0.08 + motion * 0.45 + wind * 0.18),
    rotationSpeedY: round(0.12 + motion * 0.55 + wind * 0.24),
    innerRotationSpeed: round(0.22 + humidity * 0.34 + tension * 0.38),
    pulseAmplitude: round(0.035 + precipitation * 0.16 + wind * 0.08),
    pulseRate: round(1.05 + motion * 2.4 + precipitation * 1.2),
    wireOpacity: round(0.13 + diffusion * 0.32 + tension * 0.1),
    innerOpacity: round(0.26 + brightness * 0.4 + precipitation * 0.1),
    emissiveIntensity: round(0.35 + brightness * 0.75 + tension * 0.22),
    keyLightIntensity: round(2.6 + brightness * 4.2),
    fillLightIntensity: round(1.2 + humidity * 1.9 + precipitation * 1.1),
    ambientIntensity: round(0.38 + diffusion * 0.64),
    fogNear: round(3.1 + (1 - diffusion) * 1.6),
    fogFar: round(6.6 + brightness * 2.2 - precipitation * 0.8),
    glowOpacity: round(0.12 + brightness * 0.24 + precipitation * 0.12),
    tensionTilt: round((tension - 0.5) * 0.24),
  };
}

export function serializeVisualParametersForCanvas(
  parameters: InstrumentVisualParameters,
): string {
  return JSON.stringify({
    condition: parameters.condition,
    signature: parameters.signature,
    bodyColor: parameters.bodyColor,
    accentColor: parameters.accentColor,
    rotationSpeedY: parameters.rotationSpeedY,
    pulseAmplitude: parameters.pulseAmplitude,
    wireOpacity: parameters.wireOpacity,
    glowOpacity: parameters.glowOpacity,
  });
}

function parameterValue(visual: VisualOutputState, key: string): number {
  const parameter = visual.parameters.find((entry) => entry.key === key);

  return parameter === undefined ? 0 : parameter.value;
}

function paletteColor(visual: VisualOutputState, index: number, fallback: string): string {
  return visual.palette?.[index] ?? fallback;
}

function traceValue(output: ScoreOutput, key: string): string | undefined {
  return output.trace?.find((entry) => entry.key === key)?.value;
}

function metadataString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}
