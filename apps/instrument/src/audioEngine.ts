import type { InstrumentAudioParameters } from './audioParameters.ts';

interface AudioContextConstructor {
  new (): AudioContext;
}

type BrowserWindowWithAudio = Window & {
  readonly AudioContext?: AudioContextConstructor;
  readonly webkitAudioContext?: AudioContextConstructor;
};

export class InstrumentAudioEngine {
  private context: AudioContext | undefined;
  private carrier: OscillatorNode | undefined;
  private texture: OscillatorNode | undefined;
  private filter: BiquadFilterNode | undefined;
  private carrierGain: GainNode | undefined;
  private textureGain: GainNode | undefined;
  private masterGain: GainNode | undefined;
  private muted = false;

  constructor(private readonly browserWindow: BrowserWindowWithAudio = window) {}

  get state(): AudioContextState | 'stopped' | 'unsupported' {
    const AudioContextImpl =
      this.browserWindow.AudioContext ?? this.browserWindow.webkitAudioContext;

    if (AudioContextImpl === undefined) {
      return 'unsupported';
    }

    return this.context?.state ?? 'stopped';
  }

  get isMuted(): boolean {
    return this.muted;
  }

  async start(parameters: InstrumentAudioParameters): Promise<AudioContextState | 'unsupported'> {
    const AudioContextImpl =
      this.browserWindow.AudioContext ?? this.browserWindow.webkitAudioContext;

    if (AudioContextImpl === undefined) {
      return 'unsupported';
    }

    if (this.context === undefined) {
      this.context = new AudioContextImpl();
      this.createGraph(this.context);
    }

    this.applyParameters(parameters);

    if (this.context.state === 'suspended') {
      await this.context.resume();
    }

    return this.context.state;
  }

  applyParameters(parameters: InstrumentAudioParameters): void {
    const context = this.context;

    if (context === undefined) {
      return;
    }

    const now = context.currentTime;
    this.carrier?.frequency.setTargetAtTime(parameters.carrierFrequencyHz, now, 0.025);
    this.carrier?.detune.setTargetAtTime(parameters.harmonicDetuneCents, now, 0.025);
    this.texture?.frequency.setTargetAtTime(parameters.modulationFrequencyHz, now, 0.025);
    this.filter?.frequency.setTargetAtTime(parameters.filterFrequencyHz, now, 0.04);
    this.carrierGain?.gain.setTargetAtTime(parameters.gain, now, 0.04);
    this.textureGain?.gain.setTargetAtTime(parameters.textureGain, now, 0.04);
    this.masterGain?.gain.setTargetAtTime(this.muted ? 0 : 1, now, 0.015);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;

    if (this.context === undefined) {
      return;
    }

    this.masterGain?.gain.setTargetAtTime(muted ? 0 : 1, this.context.currentTime, 0.015);
  }

  async stop(): Promise<void> {
    const context = this.context;

    if (context === undefined) {
      return;
    }

    const now = context.currentTime;
    this.masterGain?.gain.setTargetAtTime(0, now, 0.015);
    this.carrier?.stop(now + 0.04);
    this.texture?.stop(now + 0.04);
    await context.close();
    this.context = undefined;
    this.carrier = undefined;
    this.texture = undefined;
    this.filter = undefined;
    this.carrierGain = undefined;
    this.textureGain = undefined;
    this.masterGain = undefined;
  }

  private createGraph(context: AudioContext): void {
    const carrier = context.createOscillator();
    carrier.type = 'sine';

    const texture = context.createOscillator();
    texture.type = 'triangle';

    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 4.2;

    const carrierGain = context.createGain();
    carrierGain.gain.value = 0;

    const textureGain = context.createGain();
    textureGain.gain.value = 0;

    const masterGain = context.createGain();
    masterGain.gain.value = this.muted ? 0 : 1;

    carrier.connect(carrierGain).connect(filter);
    texture.connect(textureGain).connect(filter);
    filter.connect(masterGain).connect(context.destination);

    carrier.start();
    texture.start();

    this.carrier = carrier;
    this.texture = texture;
    this.filter = filter;
    this.carrierGain = carrierGain;
    this.textureGain = textureGain;
    this.masterGain = masterGain;
  }
}
