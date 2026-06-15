import type { InstrumentHapticPattern } from './hapticParameters.ts';

export type HapticPlaybackState = 'active' | 'idle' | 'unsupported' | 'rejected';

export interface HapticOutputAdapter {
  readonly isSupported: boolean;
  applyPattern(pattern: InstrumentHapticPattern): HapticPlaybackState;
  stop(): HapticPlaybackState;
}

type NavigatorWithVibration = Navigator & {
  vibrate?: (pattern: VibratePattern) => boolean;
};

export class BrowserVibrationHapticAdapter implements HapticOutputAdapter {
  constructor(private readonly browserNavigator: NavigatorWithVibration = navigator) {}

  get isSupported(): boolean {
    return typeof this.browserNavigator.vibrate === 'function';
  }

  applyPattern(pattern: InstrumentHapticPattern): HapticPlaybackState {
    if (!this.isSupported) {
      return 'unsupported';
    }

    if (!pattern.enabled || pattern.pattern.length === 0) {
      return this.stop();
    }

    return this.browserNavigator.vibrate(pattern.pattern) ? 'active' : 'rejected';
  }

  stop(): HapticPlaybackState {
    if (!this.isSupported) {
      return 'unsupported';
    }

    return this.browserNavigator.vibrate(0) ? 'idle' : 'rejected';
  }
}
