import type { JsonObject, JsonValue } from "./json.js";
import type { IsoTimestamp, NormalizedStreamState } from "./stream.js";

export type ScoreId = string;

export interface ScoreVersionMetadata {
  readonly scoreId: ScoreId;
  readonly version: string;
  readonly deterministicHash: string;
  readonly createdAt?: IsoTimestamp;
  readonly description?: string;
}

export interface ScoreFrame {
  readonly frameId: string;
  readonly frameIndex: number;
  readonly time: IsoTimestamp;
  readonly deltaMs: number;
}

export interface ScoreInput {
  readonly schemaVersion: "world-instrument.score-input.v1";
  readonly scoreId: ScoreId;
  readonly scoreVersion: ScoreVersionMetadata;
  readonly frame: ScoreFrame;
  readonly streams: readonly NormalizedStreamState[];
  readonly seed: string;
  readonly metadata?: JsonObject;
}

export type ScoreOutputKind = "visual" | "audio" | "haptic" | "lighting" | "motion";

export interface ScoreOutputChannel {
  readonly kind: ScoreOutputKind;
  readonly key: string;
  readonly value: JsonValue;
  readonly confidence?: number;
  readonly metadata?: JsonObject;
}

export interface ScoreDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly severity: "info" | "warning" | "error";
  readonly metadata?: JsonObject;
}

export interface ScoreOutput {
  readonly schemaVersion: "world-instrument.score-output.v1";
  readonly scoreId: ScoreId;
  readonly scoreVersion: ScoreVersionMetadata;
  readonly frame: ScoreFrame;
  readonly channels: readonly ScoreOutputChannel[];
  readonly diagnostics?: readonly ScoreDiagnostic[];
  readonly metadata?: JsonObject;
}

export interface ScoreContext {
  readonly now: () => IsoTimestamp;
}

export interface Score<
  TInput extends ScoreInput = ScoreInput,
  TOutput extends ScoreOutput = ScoreOutput,
> {
  readonly metadata: ScoreVersionMetadata;
  evaluate(input: TInput, context: ScoreContext): TOutput;
}
