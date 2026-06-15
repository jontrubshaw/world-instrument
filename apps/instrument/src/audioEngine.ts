import type { InstrumentAudioPlan } from './audioParameters.ts';

export interface InstrumentAudioEngine {
  readonly contextState: AudioContextState;
  start(): Promise<void>;
  update(plan: InstrumentAudioPlan, muted: boolean): void;
  stop(): void;
}

export function createInstrumentAudioEngine(
  plan: InstrumentAudioPlan,
  muted: boolean,
): InstrumentAudioEngine {
  const context = createBrowserAudioContext();

  if (context === undefined) {
    throw new Error('Web Audio API is not available in this browser.');
  }

  return new BrowserInstrumentAudioEngine(context, plan, muted);
}

class BrowserInstrumentAudioEngine implements InstrumentAudioEngine {
  readonly #context: AudioContext;
  readonly #carrier: OscillatorNode;
  readonly #filter: BiquadFilterNode;
  readonly #toneGain: GainNode;
  readonly #masterGain: GainNode;
  readonly #modulator: OscillatorNode;
  readonly #modulatorGain: GainNode;
  #started = false;
  #stopped = false;

  constructor(context: AudioContext, plan: InstrumentAudioPlan, muted: boolean) {
    this.#context = context;
    this.#carrier = context.createOscillator();
    this.#filter = context.createBiquadFilter();
    this.#toneGain = context.createGain();
    this.#masterGain = context.createGain();
    this.#modulator = context.createOscillator();
    this.#modulatorGain = context.createGain();

    this.#carrier.type = 'sine';
    this.#filter.type = 'lowpass';
    this.#masterGain.gain.value = 0;

    this.#carrier.connect(this.#toneGain);
    this.#toneGain.connect(this.#filter);
    this.#filter.connect(this.#masterGain);
    this.#masterGain.connect(context.destination);
    this.#modulator.connect(this.#modulatorGain);
    this.#modulatorGain.connect(this.#carrier.detune);

    this.update(plan, muted);
  }

  get contextState(): AudioContextState {
    return this.#context.state;
  }

  async start(): Promise<void> {
    if (this.#stopped) {
      throw new Error('Cannot restart a stopped Web Audio graph.');
    }

    if (!this.#started) {
      this.#carrier.start();
      this.#modulator.start();
      this.#started = true;
    }

    if (this.#context.state === 'suspended') {
      await this.#context.resume();
    }
  }

  update(plan: InstrumentAudioPlan, muted: boolean): void {
    if (this.#stopped) {
      return;
    }

    const now = this.#context.currentTime;
    const attackAt = now + plan.attackSeconds;
    const gainTarget = plan.enabled && !muted ? plan.carrierGain : 0;

    scheduleRamp(this.#carrier.frequency, plan.carrierFrequencyHz, now, attackAt);
    scheduleRamp(this.#filter.frequency, plan.filterFrequencyHz, now, attackAt);
    scheduleRamp(this.#filter.Q, plan.filterQ, now, attackAt);
    scheduleRamp(this.#toneGain.gain, plan.enabled ? 1 : 0, now, attackAt);
    scheduleRamp(this.#masterGain.gain, gainTarget, now, attackAt);
    scheduleRamp(this.#modulator.frequency, plan.modulationRateHz, now, attackAt);
    scheduleRamp(this.#modulatorGain.gain, plan.detuneDepthCents, now, attackAt);
  }

  stop(): void {
    if (this.#stopped) {
      return;
    }

    this.#stopped = true;
    const stopAt = this.#context.currentTime + 0.03;
    this.#masterGain.gain.cancelScheduledValues(this.#context.currentTime);
    this.#masterGain.gain.setValueAtTime(this.#masterGain.gain.value, this.#context.currentTime);
    this.#masterGain.gain.linearRampToValueAtTime(0, stopAt);

    if (this.#started) {
      this.#carrier.stop(stopAt);
      this.#modulator.stop(stopAt);
    }

    window.setTimeout(() => {
      this.#carrier.disconnect();
      this.#filter.disconnect();
      this.#toneGain.disconnect();
      this.#masterGain.disconnect();
      this.#modulator.disconnect();
      this.#modulatorGain.disconnect();
      void this.#context.close();
    }, 60);
  }
}

function createBrowserAudioContext(): AudioContext | undefined {
  const AudioContextConstructor =
    window.AudioContext ??
    (window as Window & { readonly webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  return AudioContextConstructor === undefined ? undefined : new AudioContextConstructor();
}

function scheduleRamp(parameter: AudioParam, value: number, startAt: number, endAt: number): void {
  parameter.cancelScheduledValues(startAt);
  parameter.setValueAtTime(parameter.value, startAt);
  parameter.linearRampToValueAtTime(value, endAt);
}
