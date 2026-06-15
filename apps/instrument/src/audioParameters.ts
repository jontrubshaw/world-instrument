import type { AudioOutputState, ScoreOutput } from '@world-instrument/core';

export interface InstrumentAudioParameters {
  readonly scoreId: string;
  readonly scoreVersion: string;
  readonly frameIndex: number;
  readonly generatedAt: string;
  readonly signature: string;
  readonly enabled: boolean;
  readonly carrierFrequencyHz: number;
  readonly harmonicDetuneCents: number;
  readonly filterFrequencyHz: number;
  readonly modulationFrequencyHz: number;
  readonly gain: number;
  readonly textureGain: number;
}

export const DEFAULT_AUDIO_PARAMETERS: InstrumentAudioParameters = {
  scoreId: 'weather-score',
  scoreVersion: '1.0.0',
  frameIndex: 0,
  generatedAt: '1970-01-01T00:00:00.000Z',
  signature: 'silent',
  enabled: false,
  carrierFrequencyHz: 146.83,
  harmonicDetuneCents: 0,
  filterFrequencyHz: 820,
  modulationFrequencyHz: 0.25,
  gain: 0,
  textureGain: 0,
};

export function mapScoreOutputToAudioParameters(output: ScoreOutput): InstrumentAudioParameters {
  const audio = output.audio;
  const harmonicPressure = parameterValue(audio, 'harmonicPressure');
  const grain = parameterValue(audio, 'grain');
  const tempo = parameterValue(audio, 'tempo');
  const signature =
    traceValue(output, 'inputHash') ?? `${output.scoreId}:${String(output.frameIndex)}`;
  const enabled = audio?.enabled === true;

  return {
    scoreId: output.scoreId,
    scoreVersion: output.scoreVersion,
    frameIndex: output.frameIndex,
    generatedAt: output.generatedAt,
    signature,
    enabled,
    carrierFrequencyHz: round(110 + harmonicPressure * 176 + tempo * 54),
    harmonicDetuneCents: round((harmonicPressure - 0.5) * 18),
    filterFrequencyHz: round(520 + harmonicPressure * 920 + grain * 480),
    modulationFrequencyHz: round(0.12 + tempo * 2.8),
    gain: enabled ? round(0.035 + tempo * 0.035 + harmonicPressure * 0.025) : 0,
    textureGain: enabled ? round(grain * 0.045) : 0,
  };
}

export function serializeAudioParametersForDom(parameters: InstrumentAudioParameters): string {
  return JSON.stringify({
    signature: parameters.signature,
    enabled: parameters.enabled,
    carrierFrequencyHz: parameters.carrierFrequencyHz,
    filterFrequencyHz: parameters.filterFrequencyHz,
    modulationFrequencyHz: parameters.modulationFrequencyHz,
    gain: parameters.gain,
    textureGain: parameters.textureGain,
  });
}

function parameterValue(audio: AudioOutputState | undefined, key: string): number {
  const parameter = audio?.parameters.find((entry) => entry.key === key);

  return parameter === undefined ? 0 : parameter.value;
}

function traceValue(output: ScoreOutput, key: string): string | undefined {
  return output.trace?.find((entry) => entry.key === key)?.value;
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}
