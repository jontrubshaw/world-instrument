import { describe, expect, it } from 'vitest';

import type { ScoreOutput } from '@world-instrument/core';

import {
  HAPTIC_SAFETY_LIMITS,
  enforceHapticSafety,
  mapScoreOutputToHapticPattern,
  serializeHapticPatternForDom,
  type InstrumentHapticPattern,
} from '../src/hapticParameters.ts';
import { createReplayScoreSequence, loadReplayArchives } from '../src/replayArchive.ts';
import { loadFixtureWeatherInstrumentState } from '../src/weatherInstrument.ts';

describe('weather score haptic patterns', () => {
  it('maps the fixture weather score into a stable vibration pattern', async () => {
    const state = await loadFixtureWeatherInstrumentState();

    expect(state.hapticPattern).toEqual({
      scoreId: 'weather-score',
      scoreVersion: '1.0.0',
      frameIndex: 0,
      generatedAt: '2026-06-14T21:00:00.000Z',
      signature: '8f5c7a72',
      enabled: true,
      intensity: 0.083,
      pulseDurationMs: 42,
      pauseDurationMs: 148,
      repeatCount: 1,
      pattern: [42],
    } satisfies InstrumentHapticPattern);
  });

  it('replays the same fixture into identical haptic patterns', async () => {
    const first = await loadFixtureWeatherInstrumentState();
    const second = await loadFixtureWeatherInstrumentState();

    expect(second.hapticPattern).toEqual(first.hapticPattern);
  });

  it('produces a deterministic haptic sequence from an archive', () => {
    const archive = loadReplayArchives()[0];

    if (archive === undefined) {
      throw new Error('Expected at least one replay archive.');
    }

    const firstRun = createReplayScoreSequence(archive).map(mapScoreOutputToHapticPattern);
    const secondRun = createReplayScoreSequence(archive).map(mapScoreOutputToHapticPattern);

    expect(secondRun).toEqual(firstRun);
    expect(firstRun.map((pattern) => pattern.signature)).toEqual([
      '8f5c7a72',
      '6c2d4560',
      '6247890f',
    ]);
  });

  it('serializes a compact score-driven haptic signature', async () => {
    const state = await loadFixtureWeatherInstrumentState();

    expect(JSON.parse(serializeHapticPatternForDom(state.hapticPattern))).toEqual({
      signature: '8f5c7a72',
      enabled: true,
      intensity: 0.083,
      pulseDurationMs: 42,
      repeatCount: 1,
      pattern: [42],
    });
  });

  it('clamps generated patterns to safe browser vibration limits', () => {
    const pattern = mapScoreOutputToHapticPattern(
      scoreOutputWithHapticIntensity({
        enabled: true,
        intensity: 9,
      }),
    );

    expect(pattern).toMatchObject({
      enabled: true,
      intensity: 1,
      pulseDurationMs: 120,
      pauseDurationMs: 70,
      repeatCount: 4,
      pattern: [120, 70, 120, 70, 120, 70, 120],
    });
    expect(Math.max(...pattern.pattern)).toBeLessThanOrEqual(
      HAPTIC_SAFETY_LIMITS.maxSegmentDurationMs,
    );
  });

  it('enforces safety limits on arbitrary adapter-bound patterns', () => {
    const safePattern = enforceHapticSafety([240, 240, 240, 240, 240, 240, 240, 240]);

    expect(safePattern).toEqual([180, 180, 180, 180, 180]);
    expect(safePattern).toHaveLength(5);
    expect(safePattern.reduce((total, segment) => total + segment, 0)).toBeLessThanOrEqual(
      HAPTIC_SAFETY_LIMITS.maxTotalDurationMs,
    );
  });
});

function scoreOutputWithHapticIntensity({
  enabled,
  intensity,
}: {
  readonly enabled: boolean;
  readonly intensity: number;
}): ScoreOutput {
  return {
    schemaVersion: 'score-output.v1',
    scoreId: 'weather-score',
    scoreVersion: '1.0.0',
    frameIndex: 7,
    generatedAt: '2026-06-15T03:00:00.000Z',
    visual: {
      parameters: [],
    },
    haptic: {
      enabled,
      parameters: [
        {
          key: 'pulseIntensity',
          value: intensity,
          min: 0,
          max: 1,
        },
      ],
    },
    trace: [
      {
        key: 'inputHash',
        value: 'synthetic-haptic',
      },
    ],
  };
}
