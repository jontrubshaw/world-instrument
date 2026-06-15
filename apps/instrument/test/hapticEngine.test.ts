import { describe, expect, it } from 'vitest';

import { BrowserVibrationHapticAdapter } from '../src/hapticEngine.ts';
import type { InstrumentHapticPattern } from '../src/hapticParameters.ts';

describe('BrowserVibrationHapticAdapter', () => {
  it('fails quietly when browser vibration is unsupported', () => {
    const adapter = new BrowserVibrationHapticAdapter({});

    expect(adapter.isSupported).toBe(false);
    expect(adapter.applyPattern(testPattern())).toBe('unsupported');
    expect(adapter.stop()).toBe('unsupported');
  });

  it('applies score-driven vibration patterns through navigator.vibrate', () => {
    const fakeNavigator = createFakeNavigator();
    const adapter = new BrowserVibrationHapticAdapter(fakeNavigator);

    expect(adapter.isSupported).toBe(true);
    expect(adapter.applyPattern(testPattern())).toBe('active');
    expect(fakeNavigator.calls).toEqual([[26, 105, 26]]);
  });

  it('stops vibration for disabled score patterns', () => {
    const fakeNavigator = createFakeNavigator();
    const adapter = new BrowserVibrationHapticAdapter(fakeNavigator);

    expect(adapter.applyPattern({ ...testPattern(), enabled: false, pattern: [] })).toBe('idle');
    expect(fakeNavigator.calls).toEqual([0]);
  });

  it('surfaces browser vibration rejection without throwing', () => {
    const fakeNavigator = createFakeNavigator(false);
    const adapter = new BrowserVibrationHapticAdapter(fakeNavigator);

    expect(adapter.applyPattern(testPattern())).toBe('rejected');
    expect(fakeNavigator.calls).toEqual([[26, 105, 26]]);
  });
});

interface FakeVibrationNavigator {
  readonly calls: Array<VibratePattern | Iterable<number>>;
  vibrate(pattern: VibratePattern | Iterable<number>): boolean;
}

function createFakeNavigator(accepted = true): FakeVibrationNavigator {
  const calls: Array<VibratePattern | Iterable<number>> = [];

  return {
    calls,
    vibrate(pattern: VibratePattern | Iterable<number>) {
      calls.push(pattern);

      return accepted;
    },
  };
}

function testPattern(): InstrumentHapticPattern {
  return {
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
  };
}
