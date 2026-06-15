import type { InstrumentHapticPattern } from './hapticParameters.ts';

export type HapticPlaybackState = 'active' | 'idle' | 'unsupported' | 'rejected';

export interface HapticOutputAdapter {
  readonly isSupported: boolean;
  applyPattern(pattern: InstrumentHapticPattern): HapticPlaybackState;
  stop(): HapticPlaybackState;
}

interface BrowserVibrationNavigator {
  readonly vibrate?: Navigator['vibrate'];
}

export class BrowserVibrationHapticAdapter implements HapticOutputAdapter {
  constructor(private readonly browserNavigator: BrowserVibrationNavigator = navigator) {}

  get isSupported(): boolean {
    return typeof this.browserNavigator.vibrate === 'function';
  }

  applyPattern(pattern: InstrumentHapticPattern): HapticPlaybackState {
    const vibrate = this.browserNavigator.vibrate;

    if (typeof vibrate !== 'function') {
      return 'unsupported';
    }

    if (!pattern.enabled || pattern.pattern.length === 0) {
      return this.stop();
    }

    return vibrate.call(this.browserNavigator, pattern.pattern) ? 'active' : 'rejected';
  }

  stop(): HapticPlaybackState {
    const vibrate = this.browserNavigator.vibrate;

    if (typeof vibrate !== 'function') {
      return 'unsupported';
    }

    return vibrate.call(this.browserNavigator, 0) ? 'idle' : 'rejected';
  }
}
