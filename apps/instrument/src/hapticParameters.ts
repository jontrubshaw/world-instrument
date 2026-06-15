import type { HapticOutputState, ScoreOutput } from '@world-instrument/core';

export const HAPTIC_SAFETY_LIMITS = {
  maxSegmentDurationMs: 180,
  maxPatternSegments: 7,
  maxTotalDurationMs: 900,
} as const;

export interface InstrumentHapticPattern {
  readonly scoreId: string;
  readonly scoreVersion: string;
  readonly frameIndex: number;
  readonly generatedAt: string;
  readonly signature: string;
  readonly enabled: boolean;
  readonly intensity: number;
  readonly pulseDurationMs: number;
  readonly pauseDurationMs: number;
  readonly repeatCount: number;
  readonly pattern: readonly number[];
}

export const DEFAULT_HAPTIC_PATTERN: InstrumentHapticPattern = {
  scoreId: 'weather-score',
  scoreVersion: '1.0.0',
  frameIndex: 0,
  generatedAt: '1970-01-01T00:00:00.000Z',
  signature: 'silent',
  enabled: false,
  intensity: 0,
  pulseDurationMs: 0,
  pauseDurationMs: 0,
  repeatCount: 0,
  pattern: [],
};

export function mapScoreOutputToHapticPattern(output: ScoreOutput): InstrumentHapticPattern {
  const haptic = output.haptic;
  const intensity = clamp(parameterValue(haptic, 'pulseIntensity'), 0, 1);
  const enabled = haptic?.enabled === true && intensity > 0;
  const pulseDurationMs = enabled ? Math.round(35 + intensity * 85) : 0;
  const pauseDurationMs = enabled ? Math.round(70 + (1 - intensity) * 85) : 0;
  const repeatCount = enabled ? Math.min(Math.max(Math.ceil(intensity * 4), 1), 4) : 0;
  const signature =
    traceValue(output, 'inputHash') ?? `${output.scoreId}:${String(output.frameIndex)}`;
  const pattern = enforceHapticSafety(
    enabled ? createRepeatingPulsePattern(pulseDurationMs, pauseDurationMs, repeatCount) : [],
  );

  return {
    scoreId: output.scoreId,
    scoreVersion: output.scoreVersion,
    frameIndex: output.frameIndex,
    generatedAt: output.generatedAt,
    signature,
    enabled: enabled && pattern.length > 0,
    intensity: round(intensity),
    pulseDurationMs,
    pauseDurationMs,
    repeatCount,
    pattern,
  };
}

export function enforceHapticSafety(pattern: readonly number[]): readonly number[] {
  const safePattern = pattern
    .slice(0, HAPTIC_SAFETY_LIMITS.maxPatternSegments)
    .map((segment) => Math.round(clamp(segment, 0, HAPTIC_SAFETY_LIMITS.maxSegmentDurationMs)))
    .filter((segment) => segment > 0);

  while (
    safePattern.length > 0 &&
    totalDuration(safePattern) > HAPTIC_SAFETY_LIMITS.maxTotalDurationMs
  ) {
    safePattern.pop();
  }

  return safePattern;
}

export function serializeHapticPatternForDom(parameters: InstrumentHapticPattern): string {
  return JSON.stringify({
    signature: parameters.signature,
    enabled: parameters.enabled,
    intensity: parameters.intensity,
    pulseDurationMs: parameters.pulseDurationMs,
    repeatCount: parameters.repeatCount,
    pattern: parameters.pattern,
  });
}

function createRepeatingPulsePattern(
  pulseDurationMs: number,
  pauseDurationMs: number,
  repeatCount: number,
): readonly number[] {
  return Array.from({ length: repeatCount }, (_, index) =>
    index === repeatCount - 1 ? [pulseDurationMs] : [pulseDurationMs, pauseDurationMs],
  ).flat();
}

function parameterValue(haptic: HapticOutputState | undefined, key: string): number {
  const parameter = haptic?.parameters.find((entry) => entry.key === key);

  return parameter === undefined ? 0 : parameter.value;
}

function traceValue(output: ScoreOutput, key: string): string | undefined {
  return output.trace?.find((entry) => entry.key === key)?.value;
}

function totalDuration(pattern: readonly number[]): number {
  return pattern.reduce((total, segment) => total + segment, 0);
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
