import { beforeEach, describe, expect, it } from 'vitest';

import { InstrumentAudioEngine } from '../src/audioEngine.ts';
import type { InstrumentAudioParameters } from '../src/audioParameters.ts';

describe('InstrumentAudioEngine', () => {
  beforeEach(() => {
    FakeAudioContext.instances.length = 0;
  });

  it('routes the texture oscillator as filter modulation instead of audible output', async () => {
    const engine = new InstrumentAudioEngine(fakeAudioWindow());

    await engine.start({
      scoreId: 'weather-score',
      scoreVersion: '1.0.0',
      frameIndex: 2,
      generatedAt: '2026-06-15T02:00:00.000Z',
      signature: 'test-audio-frame',
      enabled: true,
      carrierFrequencyHz: 220,
      harmonicDetuneCents: 3,
      filterFrequencyHz: 980,
      modulationFrequencyHz: 1.5,
      gain: 0.06,
      textureGain: 0.03,
    } satisfies InstrumentAudioParameters);

    const context = FakeAudioContext.instances[0];

    if (context === undefined) {
      throw new Error('Expected the audio engine to create an AudioContext.');
    }

    expect(context.oscillators[1]?.connections).toEqual([context.gains[1]]);
    expect(context.gains[1]?.connections).toEqual([context.filter.frequency]);
    expect(context.filter.connections).toEqual([context.gains[2]]);
    expect(context.gains[1]?.gain.targets.at(-1)?.value).toBe(72);
  });
});

function fakeAudioWindow(): Window {
  return {
    AudioContext: FakeAudioContext,
  } as unknown as Window;
}

interface AutomationTarget {
  readonly value: number;
  readonly startTime: number;
  readonly timeConstant: number;
}

class FakeAudioParam {
  value = 0;
  readonly targets: AutomationTarget[] = [];

  setTargetAtTime(value: number, startTime: number, timeConstant: number): this {
    this.value = value;
    this.targets.push({ value, startTime, timeConstant });

    return this;
  }
}

class FakeAudioNode {
  readonly connections: Array<FakeAudioNode | FakeAudioParam> = [];

  connect(destination: FakeAudioNode | FakeAudioParam): FakeAudioNode {
    this.connections.push(destination);

    return destination instanceof FakeAudioNode ? destination : this;
  }
}

class FakeOscillatorNode extends FakeAudioNode {
  type: OscillatorType = 'sine';
  readonly frequency = new FakeAudioParam();
  readonly detune = new FakeAudioParam();
  started = false;
  stoppedAt: number | undefined;

  start(): void {
    this.started = true;
  }

  stop(when?: number): void {
    this.stoppedAt = when;
  }
}

class FakeGainNode extends FakeAudioNode {
  readonly gain = new FakeAudioParam();
}

class FakeBiquadFilterNode extends FakeAudioNode {
  type: BiquadFilterType = 'lowpass';
  readonly frequency = new FakeAudioParam();
  readonly Q = { value: 0 };
}

class FakeAudioContext {
  static readonly instances: FakeAudioContext[] = [];

  state: AudioContextState = 'suspended';
  currentTime = 0;
  readonly destination = new FakeAudioNode();
  readonly oscillators: FakeOscillatorNode[] = [];
  readonly gains: FakeGainNode[] = [];
  readonly filter = new FakeBiquadFilterNode();

  constructor() {
    FakeAudioContext.instances.push(this);
  }

  createOscillator(): FakeOscillatorNode {
    const oscillator = new FakeOscillatorNode();
    this.oscillators.push(oscillator);

    return oscillator;
  }

  createBiquadFilter(): FakeBiquadFilterNode {
    return this.filter;
  }

  createGain(): FakeGainNode {
    const gain = new FakeGainNode();
    this.gains.push(gain);

    return gain;
  }

  resume(): Promise<void> {
    this.state = 'running';

    return Promise.resolve();
  }

  close(): Promise<void> {
    this.state = 'closed';

    return Promise.resolve();
  }
}
