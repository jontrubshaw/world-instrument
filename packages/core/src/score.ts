import type { JsonObject } from './json.js';
import type { NormalizedStreamState } from './stream.js';

export const SCORE_VERSION_SCHEMA_VERSION = 'score-version.v1' as const;
export const SCORE_INPUT_SCHEMA_VERSION = 'score-input.v1' as const;
export const SCORE_OUTPUT_SCHEMA_VERSION = 'score-output.v1' as const;

export type ScoreVersionSchemaVersion = typeof SCORE_VERSION_SCHEMA_VERSION;
export type ScoreInputSchemaVersion = typeof SCORE_INPUT_SCHEMA_VERSION;
export type ScoreOutputSchemaVersion = typeof SCORE_OUTPUT_SCHEMA_VERSION;

export interface ScoreVersionMetadata {
  readonly schemaVersion: ScoreVersionSchemaVersion;
  readonly scoreId: string;
  readonly scoreVersion: string;
  readonly displayName: string;
  readonly deterministic: true;
  readonly supportedStreamSchemas: readonly string[];
  readonly description?: string;
  readonly createdAt?: string;
  readonly metadata?: JsonObject;
}

export interface ScoreFrameContext {
  readonly frameIndex: number;
  readonly elapsedMs: number;
  readonly renderedAt?: string;
}

export interface ScoreInput {
  readonly schemaVersion: ScoreInputSchemaVersion;
  readonly score: ScoreVersionMetadata;
  readonly frame: ScoreFrameContext;
  readonly streams: readonly NormalizedStreamState[];
  readonly seed: string;
  readonly controls?: JsonObject;
  readonly previousOutput?: ScoreOutput;
}

export interface BoundedParameter {
  readonly value: number;
  readonly min: number;
  readonly max: number;
}

export interface NamedParameter extends BoundedParameter {
  readonly key: string;
}

export interface VisualOutputState {
  readonly palette?: readonly string[];
  readonly parameters: readonly NamedParameter[];
}

export interface AudioOutputState {
  readonly enabled: boolean;
  readonly parameters: readonly NamedParameter[];
}

export interface HapticOutputState {
  readonly enabled: boolean;
  readonly parameters: readonly NamedParameter[];
}

export interface ScoreTraceEntry {
  readonly key: string;
  readonly value: string;
}

export interface ScoreOutput {
  readonly schemaVersion: ScoreOutputSchemaVersion;
  readonly scoreId: string;
  readonly scoreVersion: string;
  readonly frameIndex: number;
  readonly generatedAt: string;
  readonly visual: VisualOutputState;
  readonly audio?: AudioOutputState;
  readonly haptic?: HapticOutputState;
  readonly trace?: readonly ScoreTraceEntry[];
  readonly metadata?: JsonObject;
}

export interface Score<TInput extends ScoreInput = ScoreInput, TOutput extends ScoreOutput = ScoreOutput> {
  readonly metadata: ScoreVersionMetadata;
  evaluate(input: TInput): TOutput;
}
