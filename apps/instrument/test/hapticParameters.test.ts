import { describe, expect, it } from 'vitest';

import {
  MAX_HAPTIC_PATTERN_DURATION_MS,
  enforceHapticSafetyLimits,
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
      repetitions: 2,
      pulseDurationMs: 26,
      restDurationMs: 105,
      pattern: [26, 105, 26],
      totalDurationMs: 157,
    } satisfies InstrumentHapticPattern);
  });

  it('replays the same fixture into identical haptic patterns', async () => {
    const first = await loadFixtureWeatherInstrumentState();
    const second = await loadFixtureWeatherInstrumentState();

    expect(second.hapticPattern).toEqual(first.hapticPattern);
  });

  it('produces a deterministic haptic pattern sequence from an archive', () => {
    const archive = loadReplayArchives()[0];

    if (archive === undefined) {
      throw new Error('Expected at least one replay archive.');
    }

    const firstRun = createReplayScoreSequence(archive).map((output) => output.haptic);
    const secondRun = createReplayScoreSequence(archive).map((output) => output.haptic);

    expect(secondRun).toEqual(firstRun);
    expect(firstRun).toHaveLength(3);
  });

  it('clamps excessive vibration patterns to safe browser limits', () => {
    const safePattern = enforceHapticSafetyLimits([1000, 1000, 1000, 1000, 1000, 1000, 1000]);

    expect(safePattern).toEqual([90, 120, 90, 120, 90, 120, 70]);
    expect(safePattern.reduce((total, segment) => total + segment, 0)).toBe(
      MAX_HAPTIC_PATTERN_DURATION_MS,
    );
  });

  it('serializes a compact score-driven haptic signature', async () => {
    const state = await loadFixtureWeatherInstrumentState();

    expect(JSON.parse(serializeHapticPatternForDom(state.hapticPattern))).toEqual({
      signature: '8f5c7a72',
      enabled: true,
      intensity: 0.083,
      repetitions: 2,
      pattern: [26, 105, 26],
      totalDurationMs: 157,
    });
  });
});
