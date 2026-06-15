import {
  enforceHapticSafety,
  type InstrumentHapticPattern,
} from './hapticParameters.ts';

export type HapticCapabilityState = 'supported' | 'unsupported';
export type HapticPlaybackState = 'played' | 'disabled' | 'blocked' | 'unsupported';

export interface HapticOutputAdapter {
  readonly state: HapticCapabilityState;
  play(parameters: InstrumentHapticPattern): HapticPlaybackState;
  stop(): HapticPlaybackState;
}

type BrowserNavigatorWithVibration = Omit<Navigator, 'vibrate'> & {
  vibrate?: (pattern: VibratePattern) => boolean;
};

type BrowserWindowWithVibration = Omit<Window, 'navigator'> & {
  readonly navigator: BrowserNavigatorWithVibration;
};

export class BrowserVibrationHapticEngine implements HapticOutputAdapter {
  constructor(private readonly browserWindow: BrowserWindowWithVibration = window) {}

  get state(): HapticCapabilityState {
    return this.vibrate === undefined ? 'unsupported' : 'supported';
  }

  play(parameters: InstrumentHapticPattern): HapticPlaybackState {
    const vibrate = this.vibrate;

    if (vibrate === undefined) {
      return 'unsupported';
    }

    if (!parameters.enabled || parameters.pattern.length === 0) {
      vibrate(0);

      return 'disabled';
    }

    const pattern = enforceHapticSafety(parameters.pattern);

    if (pattern.length === 0) {
      vibrate(0);

      return 'disabled';
    }

    return vibrate(pattern as number[]) ? 'played' : 'blocked';
  }

  stop(): HapticPlaybackState {
    const vibrate = this.vibrate;

    if (vibrate === undefined) {
      return 'unsupported';
    }

    vibrate(0);

    return 'disabled';
  }

  private get vibrate(): BrowserNavigatorWithVibration['vibrate'] {
    const vibrate = this.browserWindow.navigator.vibrate;

    return typeof vibrate === 'function' ? vibrate.bind(this.browserWindow.navigator) : undefined;
  }
}
