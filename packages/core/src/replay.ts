import type { JsonObject, JsonValue } from "./json.js";
import { isJsonObject } from "./json.js";
import type {
  ScoreDiagnostic,
  ScoreFrame,
  ScoreOutput,
  ScoreOutputChannel,
  ScoreVersionMetadata,
} from "./score.js";
import type { NormalizedStreamChannel, NormalizedStreamState, StreamIssue } from "./stream.js";

export const REPLAY_SNAPSHOT_SCHEMA_VERSION = "world-instrument.replay-snapshot.v1";

export interface ReplayScoreSnapshot {
  readonly scoreId: string;
  readonly scoreVersion: ScoreVersionMetadata;
  readonly output: ScoreOutput;
  readonly metadata?: JsonObject;
}

export interface ReplaySnapshot {
  readonly schemaVersion: typeof REPLAY_SNAPSHOT_SCHEMA_VERSION;
  readonly replayId: string;
  readonly capturedAt: string;
  readonly frame: ScoreFrame;
  readonly streams: readonly NormalizedStreamState[];
  readonly scores?: readonly ReplayScoreSnapshot[];
  readonly metadata?: JsonObject;
}

export const replaySnapshotJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://world-instrument.local/schemas/replay-snapshot.v1.json",
  title: "World Instrument Replay Snapshot",
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "replayId", "capturedAt", "frame", "streams"],
  properties: {
    schemaVersion: { const: REPLAY_SNAPSHOT_SCHEMA_VERSION },
    replayId: { type: "string", minLength: 1 },
    capturedAt: { type: "string", format: "date-time" },
    frame: {
      type: "object",
      additionalProperties: false,
      required: ["frameId", "frameIndex", "time", "deltaMs"],
      properties: {
        frameId: { type: "string", minLength: 1 },
        frameIndex: { type: "integer", minimum: 0 },
        time: { type: "string", format: "date-time" },
        deltaMs: { type: "number", minimum: 0 },
      },
    },
    streams: { type: "array", minItems: 1 },
    scores: { type: "array" },
    metadata: { type: "object" },
  },
} as const satisfies JsonObject;

export function isReplaySnapshot(value: unknown): value is ReplaySnapshot {
  if (!isJsonObject(value)) {
    return false;
  }

  return (
    value.schemaVersion === REPLAY_SNAPSHOT_SCHEMA_VERSION &&
    isNonEmptyString(value.replayId) &&
    isNonEmptyString(value.capturedAt) &&
    isScoreFrame(value.frame) &&
    Array.isArray(value.streams) &&
    value.streams.length > 0 &&
    value.streams.every(isNormalizedStreamState) &&
    isOptionalArrayOf(value.scores, isReplayScoreSnapshot) &&
    isOptionalJsonObject(value.metadata)
  );
}

export function assertReplaySnapshot(value: unknown): asserts value is ReplaySnapshot {
  if (!isReplaySnapshot(value)) {
    throw new TypeError("Value does not match replay snapshot schema v1.");
  }
}

export function parseReplaySnapshot(value: unknown): ReplaySnapshot {
  assertReplaySnapshot(value);
  return value;
}

function isReplayScoreSnapshot(value: unknown): value is ReplayScoreSnapshot {
  if (!isJsonObject(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.scoreId) &&
    isScoreVersionMetadata(value.scoreVersion) &&
    isScoreOutput(value.output) &&
    isOptionalJsonObject(value.metadata)
  );
}

function isScoreOutput(value: unknown): value is ScoreOutput {
  if (!isJsonObject(value)) {
    return false;
  }

  return (
    value.schemaVersion === "world-instrument.score-output.v1" &&
    isNonEmptyString(value.scoreId) &&
    isScoreVersionMetadata(value.scoreVersion) &&
    isScoreFrame(value.frame) &&
    Array.isArray(value.channels) &&
    value.channels.every(isScoreOutputChannel) &&
    isOptionalArrayOf(value.diagnostics, isDiagnostic) &&
    isOptionalJsonObject(value.metadata)
  );
}

function isScoreVersionMetadata(value: unknown): value is ScoreVersionMetadata {
  if (!isJsonObject(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.scoreId) &&
    isNonEmptyString(value.version) &&
    isNonEmptyString(value.deterministicHash) &&
    isOptionalString(value.createdAt) &&
    isOptionalString(value.description)
  );
}

function isScoreFrame(value: unknown): value is ScoreFrame {
  if (!isJsonObject(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.frameId) &&
    isNonNegativeInteger(value.frameIndex) &&
    isNonEmptyString(value.time) &&
    isNonNegativeFiniteNumber(value.deltaMs)
  );
}

function isNormalizedStreamState(value: unknown): value is NormalizedStreamState {
  if (!isJsonObject(value)) {
    return false;
  }

  return (
    value.schemaVersion === "world-instrument.normalized-stream-state.v1" &&
    isNonEmptyString(value.streamId) &&
    isNonEmptyString(value.adapterId) &&
    isOptionalString(value.sourceId) &&
    isStreamStateStatus(value.status) &&
    isNonEmptyString(value.observedAt) &&
    isOptionalString(value.receivedAt) &&
    isNonNegativeInteger(value.sequence) &&
    Array.isArray(value.channels) &&
    value.channels.every(isNormalizedStreamChannel) &&
    isOptionalArrayOf(value.issues, isStreamIssue) &&
    isOptionalJsonObject(value.metadata)
  );
}

function isNormalizedStreamChannel(value: unknown): value is NormalizedStreamChannel {
  if (!isJsonObject(value) || !hasBaseChannelFields(value)) {
    return false;
  }

  switch (value.kind) {
    case "scalar":
      return isFiniteNumber(value.value) && isOptionalString(value.unit);
    case "rate":
      return (
        isFiniteNumber(value.value) &&
        isRatePeriod(value.per) &&
        isOptionalString(value.unit)
      );
    case "category":
      return (
        isNonEmptyString(value.value) &&
        (value.vocabulary === undefined ||
          (Array.isArray(value.vocabulary) && value.vocabulary.every(isNonEmptyString)))
      );
    case "flag":
      return typeof value.value === "boolean";
    case "event":
      return isNonEmptyString(value.value) && isOptionalFiniteNumber(value.weight);
    default:
      return false;
  }
}

function hasBaseChannelFields(value: JsonObject): boolean {
  return (
    isNonEmptyString(value.key) &&
    isOptionalString(value.label) &&
    isOptionalFiniteNumber(value.confidence) &&
    isOptionalString(value.observedAt) &&
    isOptionalJsonObject(value.metadata)
  );
}

function isStreamIssue(value: unknown): value is StreamIssue {
  if (!isJsonObject(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.code) &&
    isNonEmptyString(value.message) &&
    isSeverity(value.severity) &&
    isOptionalJsonObject(value.metadata)
  );
}

function isScoreOutputChannel(value: unknown): value is ScoreOutputChannel {
  if (!isJsonObject(value)) {
    return false;
  }

  return (
    isScoreOutputKind(value.kind) &&
    isNonEmptyString(value.key) &&
    isJsonValue(value.value) &&
    isOptionalFiniteNumber(value.confidence) &&
    isOptionalJsonObject(value.metadata)
  );
}

function isDiagnostic(value: unknown): value is ScoreDiagnostic {
  if (!isJsonObject(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.code) &&
    isNonEmptyString(value.message) &&
    isSeverity(value.severity) &&
    isOptionalJsonObject(value.metadata)
  );
}

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    isFiniteNumber(value)
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  if (isJsonObject(value)) {
    return Object.values(value).every(isJsonValue);
  }

  return false;
}

function isOptionalArrayOf<T>(
  value: unknown,
  predicate: (item: unknown) => item is T,
): value is readonly T[] | undefined {
  return value === undefined || (Array.isArray(value) && value.every(predicate));
}

function isOptionalJsonObject(value: unknown): value is JsonObject | undefined {
  return value === undefined || isJsonObject(value);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isOptionalFiniteNumber(value: unknown): value is number | undefined {
  return value === undefined || isFiniteNumber(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function isStreamStateStatus(value: unknown): boolean {
  return value === "active" || value === "stale" || value === "error" || value === "ended";
}

function isRatePeriod(value: unknown): boolean {
  return value === "second" || value === "minute" || value === "hour" || value === "day";
}

function isSeverity(value: unknown): boolean {
  return value === "info" || value === "warning" || value === "error";
}

function isScoreOutputKind(value: unknown): boolean {
  return (
    value === "visual" ||
    value === "audio" ||
    value === "haptic" ||
    value === "lighting" ||
    value === "motion"
  );
}
