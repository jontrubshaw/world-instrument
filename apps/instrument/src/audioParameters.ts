import type { AudioOutputState, ScoreOutput } from '@world-instrument/core';

export interface InstrumentAudioPlan {
  readonly scoreId: string;
  readonly scoreVersion: string;
  readonly frameIndex: number;
  readonly generatedAt: string;
  readonly signature: string;
  readonly enabled: boolean;
  readonly carrierFrequencyHz: number;
  readonly carrierGain: number;
  readonly filterFrequencyHz: number;
  readonly filterQ: number;
  readonly detuneDepthCents: number;
  readonly modulationRateHz: number;
  readonly attackSeconds: number;
  readonly releaseSeconds: number;
}

export const DEFAULT_AUDIO_PLAN: InstrumentAudioPlan = {
  scoreId: 'weather-score',
  scoreVersion: '1.0.0',
  frameIndex: 0,
  generatedAt: '1970-01-01T00:00:00.000Z',
  signature: 'silent',
  enabled: false,
  carrierFrequencyHz: 164.81,
  carrierGain: 0,
  filterFrequencyHz: 420,
  filterQ: 0.8,
  detuneDepthCents: 0,
  modulationRateHz: 0.2,
  attackSeconds: 0.08,
  releaseSeconds: 0.16,
};

export function mapScoreOutputToAudioPlan(output: ScoreOutput): InstrumentAudioPlan {
  const audio = output.audio;
  const harmonicPressure = audioParameterValue(audio, 'harmonicPressure');
  const grain = audioParameterValue(audio, 'grain');
  const tempo = audioParameterValue(audio, 'tempo');
  const signature =
    traceValue(output, 'inputHash') ?? `${output.scoreId}:${String(output.frameIndex)}`;

  return {
    scoreId: output.scoreId,
    scoreVersion: output.scoreVersion,
    frameIndex: output.frameIndex,
    generatedAt: output.generatedAt,
    signature,
    enabled: audio?.enabled === true,
    carrierFrequencyHz: round(130.81 + harmonicPressure * 246.94 + tempo * 72),
    carrierGain: audio?.enabled === true ? round(0.035 + (1 - grain) * 0.025 + tempo * 0.02) : 0,
    filterFrequencyHz: round(340 + grain * 1_520 + harmonicPressure * 860),
    filterQ: round(0.7 + harmonicPressure * 5.8 + grain * 1.7),
    detuneDepthCents: round(8 + grain * 36 + harmonicPressure * 24),
    modulationRateHz: round(0.18 + tempo * 5.6),
    attackSeconds: round(0.035 + (1 - tempo) * 0.09),
    releaseSeconds: round(0.12 + grain * 0.22 + harmonicPressure * 0.12),
  };
}

export function serializeAudioPlanForDom(plan: InstrumentAudioPlan): string {
  return JSON.stringify({
    signature: plan.signature,
    frameIndex: plan.frameIndex,
    carrierFrequencyHz: plan.carrierFrequencyHz,
    filterFrequencyHz: plan.filterFrequencyHz,
    modulationRateHz: plan.modulationRateHz,
    enabled: plan.enabled,
  });
}

function audioParameterValue(audio: AudioOutputState | undefined, key: string): number {
  const parameter = audio?.parameters.find((entry) => entry.key === key);

  return parameter === undefined ? 0 : parameter.value;
}

function traceValue(output: ScoreOutput, key: string): string | undefined {
  return output.trace?.find((entry) => entry.key === key)?.value;
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}
