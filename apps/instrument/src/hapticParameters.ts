import type { HapticOutputState, ScoreOutput } from '@world-instrument/core';

export const MAX_HAPTIC_REPETITIONS = 4;
export const MAX_HAPTIC_PULSE_MS = 90;
export const MAX_HAPTIC_REST_MS = 120;
export const MAX_HAPTIC_PATTERN_DURATION_MS = 700;
export const MAX_HAPTIC_PATTERN_SEGMENTS = MAX_HAPTIC_REPETITIONS * 2 - 1;

export interface InstrumentHapticPattern {
  readonly scoreId: string;
  readonly scoreVersion: string;
  readonly frameIndex: number;
  readonly generatedAt: string;
  readonly signature: string;
  readonly enabled: boolean;
  readonly intensity: number;
  readonly repetitions: number;
  readonly pulseDurationMs: number;
  readonly restDurationMs: number;
  readonly pattern: readonly number[];
  readonly totalDurationMs: number;
}

export const DEFAULT_HAPTIC_PATTERN: InstrumentHapticPattern = {
  scoreId: 'weather-score',
  scoreVersion: '1.0.0',
  frameIndex: 0,
  generatedAt: '1970-01-01T00:00:00.000Z',
  signature: 'silent',
  enabled: false,
  intensity: 0,
  repetitions: 0,
  pulseDurationMs: 0,
  restDurationMs: 0,
  pattern: [],
  totalDurationMs: 0,
};

export function mapScoreOutputToHapticPattern(output: ScoreOutput): InstrumentHapticPattern {
  const haptic = output.haptic;
  const intensity = round(parameterValue(haptic, 'pulseIntensity'));
  const signature =
    traceValue(output, 'inputHash') ?? `${output.scoreId}:${String(output.frameIndex)}`;
  const enabled = haptic?.enabled === true && intensity > 0;

  if (!enabled) {
    return {
      ...DEFAULT_HAPTIC_PATTERN,
      scoreId: output.scoreId,
      scoreVersion: output.scoreVersion,
      frameIndex: output.frameIndex,
      generatedAt: output.generatedAt,
      signature,
    };
  }

  const repetitions = Math.min(1 + Math.ceil(intensity * 3), MAX_HAPTIC_REPETITIONS);
  const pulseDurationMs = Math.min(Math.round(20 + intensity * 70), MAX_HAPTIC_PULSE_MS);
  const restDurationMs = Math.min(Math.round(45 + (1 - intensity) * 65), MAX_HAPTIC_REST_MS);
  const pattern = enforceHapticSafetyLimits(
    Array.from({ length: repetitions * 2 - 1 }, (_entry, index) =>
      index % 2 === 0 ? pulseDurationMs : restDurationMs,
    ),
  );

  return {
    scoreId: output.scoreId,
    scoreVersion: output.scoreVersion,
    frameIndex: output.frameIndex,
    generatedAt: output.generatedAt,
    signature,
    enabled: pattern.length > 0,
    intensity,
    repetitions: Math.ceil(pattern.length / 2),
    pulseDurationMs,
    restDurationMs,
    pattern,
    totalDurationMs: totalHapticPatternDuration(pattern),
  };
}

export function enforceHapticSafetyLimits(pattern: readonly number[]): readonly number[] {
  const sanitizedPattern: number[] = [];
  let totalDurationMs = 0;

  for (let index = 0; index < pattern.length && index < MAX_HAPTIC_PATTERN_SEGMENTS; index += 1) {
    const rawSegment = pattern[index];

    if (rawSegment === undefined || !Number.isFinite(rawSegment) || rawSegment <= 0) {
      continue;
    }

    const segmentLimit = index % 2 === 0 ? MAX_HAPTIC_PULSE_MS : MAX_HAPTIC_REST_MS;
    const safeSegment = Math.min(Math.round(rawSegment), segmentLimit);
    const remainingDurationMs = MAX_HAPTIC_PATTERN_DURATION_MS - totalDurationMs;

    if (remainingDurationMs <= 0) {
      break;
    }

    const nextSegment = Math.min(safeSegment, remainingDurationMs);
    sanitizedPattern.push(nextSegment);
    totalDurationMs += nextSegment;
  }

  if (sanitizedPattern.length % 2 === 0) {
    sanitizedPattern.pop();
  }

  return sanitizedPattern;
}

export function serializeHapticPatternForDom(pattern: InstrumentHapticPattern): string {
  return JSON.stringify({
    signature: pattern.signature,
    enabled: pattern.enabled,
    intensity: pattern.intensity,
    repetitions: pattern.repetitions,
    pattern: pattern.pattern,
    totalDurationMs: pattern.totalDurationMs,
  });
}

function totalHapticPatternDuration(pattern: readonly number[]): number {
  return pattern.reduce((total, segment) => total + segment, 0);
}

function parameterValue(haptic: HapticOutputState | undefined, key: string): number {
  const parameter = haptic?.parameters.find((entry) => entry.key === key);

  return parameter === undefined ? 0 : parameter.value;
}

function traceValue(output: ScoreOutput, key: string): string | undefined {
  return output.trace?.find((entry) => entry.key === key)?.value;
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}
