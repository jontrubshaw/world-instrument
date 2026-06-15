import { describe, expect, it } from 'vitest';

import { BrowserVibrationHapticEngine } from '../src/hapticEngine.ts';
import type { InstrumentHapticPattern } from '../src/hapticParameters.ts';

describe('BrowserVibrationHapticEngine', () => {
  it('fails quietly when the Vibration API is unavailable', () => {
    const engine = new BrowserVibrationHapticEngine(fakeVibrationWindow());

    expect(engine.state).toBe('unsupported');
    expect(engine.play(hapticPattern({ enabled: true, pattern: [40] }))).toBe('unsupported');
    expect(engine.stop()).toBe('unsupported');
  });

  it('applies safety limits before vibrating', () => {
    const vibrationCalls: VibratePattern[] = [];
    const engine = new BrowserVibrationHapticEngine(
      fakeVibrationWindow((pattern) => {
        vibrationCalls.push(pattern);

        return true;
      }),
    );

    expect(engine.state).toBe('supported');
    expect(
      engine.play(hapticPattern({ enabled: true, pattern: [250, 250, 250, 250, 250, 250] })),
    ).toBe('played');
    expect(vibrationCalls).toEqual([[180, 180, 180, 180, 180]]);
  });

  it('stops vibration instead of playing disabled score patterns', () => {
    const vibrationCalls: VibratePattern[] = [];
    const engine = new BrowserVibrationHapticEngine(
      fakeVibrationWindow((pattern) => {
        vibrationCalls.push(pattern);

        return true;
      }),
    );

    expect(engine.play(hapticPattern({ enabled: false, pattern: [60] }))).toBe('disabled');
    expect(engine.stop()).toBe('disabled');
    expect(vibrationCalls).toEqual([0, 0]);
  });

  it('reports browser-level vibration blocking without throwing', () => {
    const engine = new BrowserVibrationHapticEngine(fakeVibrationWindow(() => false));

    expect(engine.play(hapticPattern({ enabled: true, pattern: [60] }))).toBe('blocked');
  });
});

function fakeVibrationWindow(vibrate?: (pattern: VibratePattern) => boolean): Window {
  return {
    navigator: {
      vibrate,
    },
  } as unknown as Window;
}

function hapticPattern({
  enabled,
  pattern,
}: {
  readonly enabled: boolean;
  readonly pattern: readonly number[];
}): InstrumentHapticPattern {
  return {
    scoreId: 'weather-score',
    scoreVersion: '1.0.0',
    frameIndex: 0,
    generatedAt: '2026-06-15T03:00:00.000Z',
    signature: 'test-haptic',
    enabled,
    intensity: enabled ? 1 : 0,
    pulseDurationMs: pattern[0] ?? 0,
    pauseDurationMs: pattern[1] ?? 0,
    repeatCount: pattern.length,
    pattern,
  };
}
