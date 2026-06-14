import {
  SCORE_OUTPUT_SCHEMA_VERSION,
  SCORE_VERSION_SCHEMA_VERSION,
  type ScoreOutput,
  type ScoreVersionMetadata,
} from './score.js';
import {
  STREAM_STATE_SCHEMA_VERSION,
  type NormalizedStreamState,
  type StreamSample,
  type StreamStatus,
} from './stream.js';
import type { JsonObject, JsonValue } from './json.js';

export const REPLAY_SNAPSHOT_SCHEMA_VERSION = 'replay-snapshot.v1' as const;

export type ReplaySnapshotSchemaVersion = typeof REPLAY_SNAPSHOT_SCHEMA_VERSION;

export interface ReplayFrame {
  readonly frameIndex: number;
  readonly elapsedMs: number;
  readonly capturedAt: string;
  readonly streams: readonly NormalizedStreamState[];
  readonly output?: ScoreOutput;
  readonly seed?: string;
}

export interface ReplaySnapshot {
  readonly schemaVersion: ReplaySnapshotSchemaVersion;
  readonly snapshotId: string;
  readonly createdAt: string;
  readonly score: ScoreVersionMetadata;
  readonly frames: readonly ReplayFrame[];
  readonly metadata?: JsonObject;
}

export class ReplaySnapshotValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Invalid replay snapshot: ${issues.join('; ')}`);
    this.name = 'ReplaySnapshotValidationError';
    this.issues = issues;
  }
}

export function parseReplaySnapshot(value: unknown): ReplaySnapshot {
  const issues = validateReplaySnapshot(value);

  if (issues.length > 0) {
    throw new ReplaySnapshotValidationError(issues);
  }

  return value as ReplaySnapshot;
}

export function isReplaySnapshot(value: unknown): value is ReplaySnapshot {
  return validateReplaySnapshot(value).length === 0;
}

export function validateReplaySnapshot(value: unknown): readonly string[] {
  const issues: string[] = [];

  if (!isRecord(value)) {
    return ['snapshot must be an object'];
  }

  requireLiteral(value, 'schemaVersion', REPLAY_SNAPSHOT_SCHEMA_VERSION, '$', issues);
  requireString(value, 'snapshotId', '$', issues);
  requireTimestamp(value, 'createdAt', '$', issues);
  validateOptionalJsonObject(value, 'metadata', '$', issues);

  const score = requireRecord(value, 'score', '$', issues);
  if (score !== undefined) {
    validateScoreVersionMetadata(score, '$.score', issues);
  }

  const frames = requireArray(value, 'frames', '$', issues);
  if (frames !== undefined) {
    if (frames.length === 0) {
      issues.push('$.frames must include at least one frame');
    }

    frames.forEach((frame, index) => {
      validateReplayFrame(frame, `$.frames[${String(index)}]`, score, issues);
    });
  }

  return issues;
}

function validateReplayFrame(
  value: unknown,
  path: string,
  score: Record<string, unknown> | undefined,
  issues: string[],
): void {
  if (!isRecord(value)) {
    issues.push(`${path} must be an object`);
    return;
  }

  const frameIndex = requireNonNegativeInteger(value, 'frameIndex', path, issues);
  requireNonNegativeNumber(value, 'elapsedMs', path, issues);
  requireTimestamp(value, 'capturedAt', path, issues);
  validateOptionalString(value, 'seed', path, issues);

  const streams = requireArray(value, 'streams', path, issues);
  if (streams !== undefined) {
    if (streams.length === 0) {
      issues.push(`${path}.streams must include at least one normalized stream state`);
    }

    streams.forEach((stream, index) => {
      validateNormalizedStreamState(stream, `${path}.streams[${String(index)}]`, issues);
    });
  }

  const output = optionalRecord(value, 'output', path, issues);
  if (output !== undefined) {
    validateScoreOutput(output, `${path}.output`, issues);
    validateScoreOutputContext(output, `${path}.output`, score, frameIndex, issues);
  }
}

function validateScoreOutputContext(
  output: Record<string, unknown>,
  path: string,
  score: Record<string, unknown> | undefined,
  frameIndex: number | undefined,
  issues: string[],
): void {
  if (score !== undefined && typeof score.scoreId === 'string') {
    requireMatchingValue(output, 'scoreId', score.scoreId, '$.score.scoreId', path, issues);
  }

  if (score !== undefined && typeof score.scoreVersion === 'string') {
    requireMatchingValue(
      output,
      'scoreVersion',
      score.scoreVersion,
      '$.score.scoreVersion',
      path,
      issues,
    );
  }

  if (
    frameIndex !== undefined &&
    typeof output.frameIndex === 'number' &&
    output.frameIndex !== frameIndex
  ) {
    issues.push(`${path}.frameIndex must match the enclosing frameIndex`);
  }
}

function validateScoreVersionMetadata(
  value: Record<string, unknown>,
  path: string,
  issues: string[],
): void {
  requireLiteral(value, 'schemaVersion', SCORE_VERSION_SCHEMA_VERSION, path, issues);
  requireString(value, 'scoreId', path, issues);
  requireString(value, 'scoreVersion', path, issues);
  requireString(value, 'displayName', path, issues);
  requireLiteral(value, 'deterministic', true, path, issues);
  requireStringArray(value, 'supportedStreamSchemas', path, issues);
  validateOptionalString(value, 'description', path, issues);
  validateOptionalTimestamp(value, 'createdAt', path, issues);
  validateOptionalJsonObject(value, 'metadata', path, issues);
}

function validateNormalizedStreamState(value: unknown, path: string, issues: string[]): void {
  if (!isRecord(value)) {
    issues.push(`${path} must be an object`);
    return;
  }

  requireLiteral(value, 'schemaVersion', STREAM_STATE_SCHEMA_VERSION, path, issues);
  requireString(value, 'streamId', path, issues);
  validateStreamSource(value, path, issues);
  requireOneOf(value, 'status', ['degraded', 'error', 'ok', 'stale'], path, issues);
  requireTimestamp(value, 'observedAt', path, issues);
  requireTimestamp(value, 'receivedAt', path, issues);
  requireNonNegativeInteger(value, 'sequence', path, issues);
  validateOptionalJsonObject(value, 'metadata', path, issues);

  const samples = requireArray(value, 'samples', path, issues);
  if (samples !== undefined) {
    samples.forEach((sample, index) => {
      validateStreamSample(sample, `${path}.samples[${String(index)}]`, issues);
    });
  }
}

function validateStreamSource(
  value: Record<string, unknown>,
  path: string,
  issues: string[],
): void {
  const source = requireRecord(value, 'source', path, issues);

  if (source === undefined) {
    return;
  }

  requireString(source, 'id', `${path}.source`, issues);
  requireString(source, 'kind', `${path}.source`, issues);
  validateOptionalString(source, 'label', `${path}.source`, issues);
  validateOptionalString(source, 'uri', `${path}.source`, issues);
}

function validateStreamSample(value: unknown, path: string, issues: string[]): void {
  if (!isRecord(value)) {
    issues.push(`${path} must be an object`);
    return;
  }

  requireString(value, 'key', path, issues);
  validateOptionalString(value, 'label', path, issues);
  requireTimestamp(value, 'observedAt', path, issues);
  requireOneOf(value, 'quality', ['estimated', 'measured', 'missing'], path, issues);

  const kind = value.kind;
  if (kind !== 'boolean' && kind !== 'categorical' && kind !== 'numeric' && kind !== 'vector') {
    issues.push(`${path}.kind must be one of boolean, categorical, numeric, vector`);
    return;
  }

  if (kind === 'numeric') {
    requireFiniteNumber(value, 'value', path, issues);
    validateOptionalString(value, 'unit', path, issues);
    validateOptionalFiniteNumber(value, 'delta', path, issues);
    validateOptionalFiniteNumber(value, 'rollingAverage', path, issues);
    return;
  }

  if (kind === 'categorical') {
    requireString(value, 'value', path, issues);
    validateOptionalConfidence(value, path, issues);
    return;
  }

  if (kind === 'boolean') {
    requireBoolean(value, 'value', path, issues);
    validateOptionalConfidence(value, path, issues);
    return;
  }

  validateNumberArray(value, 'values', path, issues);
  validateOptionalStringArray(value, 'axes', path, issues);
  validateOptionalString(value, 'unit', path, issues);
}

function validateScoreOutput(value: Record<string, unknown>, path: string, issues: string[]): void {
  requireLiteral(value, 'schemaVersion', SCORE_OUTPUT_SCHEMA_VERSION, path, issues);
  requireString(value, 'scoreId', path, issues);
  requireString(value, 'scoreVersion', path, issues);
  requireNonNegativeInteger(value, 'frameIndex', path, issues);
  requireTimestamp(value, 'generatedAt', path, issues);
  validateOptionalJsonObject(value, 'metadata', path, issues);

  const visual = requireRecord(value, 'visual', path, issues);
  if (visual !== undefined) {
    validateOptionalStringArray(visual, 'palette', `${path}.visual`, issues);
    validateNamedParameters(visual, 'parameters', `${path}.visual`, issues);
  }

  validateOptionalModality(value, 'audio', path, issues);
  validateOptionalModality(value, 'haptic', path, issues);

  const trace = optionalArray(value, 'trace', path, issues);
  if (trace !== undefined) {
    trace.forEach((entry, index) => {
      validateTraceEntry(entry, `${path}.trace[${String(index)}]`, issues);
    });
  }
}

function validateOptionalModality(
  value: Record<string, unknown>,
  key: 'audio' | 'haptic',
  path: string,
  issues: string[],
): void {
  const modality = optionalRecord(value, key, path, issues);

  if (modality === undefined) {
    return;
  }

  requireBoolean(modality, 'enabled', `${path}.${key}`, issues);
  validateNamedParameters(modality, 'parameters', `${path}.${key}`, issues);
}

function validateNamedParameters(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[],
): void {
  const parameters = requireArray(value, key, path, issues);

  if (parameters === undefined) {
    return;
  }

  parameters.forEach((parameter, index) => {
    const parameterPath = `${path}.${key}[${String(index)}]`;

    if (!isRecord(parameter)) {
      issues.push(`${parameterPath} must be an object`);
      return;
    }

    requireString(parameter, 'key', parameterPath, issues);
    requireFiniteNumber(parameter, 'value', parameterPath, issues);
    requireFiniteNumber(parameter, 'min', parameterPath, issues);
    requireFiniteNumber(parameter, 'max', parameterPath, issues);

    const min = parameter.min;
    const max = parameter.max;
    const current = parameter.value;
    if (typeof min === 'number' && typeof max === 'number' && max < min) {
      issues.push(`${parameterPath}.max must be greater than or equal to min`);
    }
    if (
      typeof min === 'number' &&
      typeof max === 'number' &&
      typeof current === 'number' &&
      (current < min || current > max)
    ) {
      issues.push(`${parameterPath}.value must be between min and max`);
    }
  });
}

function validateTraceEntry(value: unknown, path: string, issues: string[]): void {
  if (!isRecord(value)) {
    issues.push(`${path} must be an object`);
    return;
  }

  requireString(value, 'key', path, issues);
  requireString(value, 'value', path, issues);
}

function requireString(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[],
): string | undefined {
  const item = value[key];

  if (typeof item !== 'string' || item.length === 0) {
    issues.push(`${path}.${key} must be a non-empty string`);
    return undefined;
  }

  return item;
}

function validateOptionalString(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[],
): void {
  if (value[key] !== undefined && typeof value[key] !== 'string') {
    issues.push(`${path}.${key} must be a string when provided`);
  }
}

function requireBoolean(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[],
): boolean | undefined {
  const item = value[key];

  if (typeof item !== 'boolean') {
    issues.push(`${path}.${key} must be a boolean`);
    return undefined;
  }

  return item;
}

function requireLiteral(
  value: Record<string, unknown>,
  key: string,
  expected: boolean | number | string,
  path: string,
  issues: string[],
): void {
  if (value[key] !== expected) {
    issues.push(`${path}.${key} must be ${String(expected)}`);
  }
}

function requireMatchingValue(
  value: Record<string, unknown>,
  key: string,
  expected: string,
  expectedPath: string,
  path: string,
  issues: string[],
): void {
  if (typeof value[key] === 'string' && value[key] !== expected) {
    issues.push(`${path}.${key} must match ${expectedPath}`);
  }
}

type AllowedStringLiteral = StreamSample['kind'] | StreamSample['quality'] | StreamStatus;

function requireOneOf(
  value: Record<string, unknown>,
  key: string,
  expected: readonly AllowedStringLiteral[],
  path: string,
  issues: string[],
): void {
  if (!isAllowedStringLiteral(value[key], expected)) {
    issues.push(`${path}.${key} must be one of ${expected.join(', ')}`);
  }
}

function requireFiniteNumber(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[],
): number | undefined {
  const item = value[key];

  if (typeof item !== 'number' || !Number.isFinite(item)) {
    issues.push(`${path}.${key} must be a finite number`);
    return undefined;
  }

  return item;
}

function validateOptionalFiniteNumber(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[],
): void {
  if (value[key] !== undefined) {
    requireFiniteNumber(value, key, path, issues);
  }
}

function requireNonNegativeNumber(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[],
): number | undefined {
  const item = requireFiniteNumber(value, key, path, issues);

  if (item !== undefined && item < 0) {
    issues.push(`${path}.${key} must be greater than or equal to 0`);
  }

  return item;
}

function requireNonNegativeInteger(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[],
): number | undefined {
  const item = requireNonNegativeNumber(value, key, path, issues);

  if (item !== undefined && !Number.isInteger(item)) {
    issues.push(`${path}.${key} must be an integer`);
  }

  return item;
}

function requireTimestamp(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[],
): void {
  const item = requireString(value, key, path, issues);

  if (item !== undefined && Number.isNaN(Date.parse(item))) {
    issues.push(`${path}.${key} must be a parseable timestamp`);
  }
}

function validateOptionalTimestamp(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[],
): void {
  if (value[key] === undefined) {
    return;
  }

  if (typeof value[key] !== 'string' || Number.isNaN(Date.parse(value[key]))) {
    issues.push(`${path}.${key} must be a parseable timestamp when provided`);
  }
}

function requireRecord(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[],
): Record<string, unknown> | undefined {
  const item = value[key];

  if (!isRecord(item)) {
    issues.push(`${path}.${key} must be an object`);
    return undefined;
  }

  return item;
}

function optionalRecord(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[],
): Record<string, unknown> | undefined {
  const item = value[key];

  if (item === undefined) {
    return undefined;
  }

  if (!isRecord(item)) {
    issues.push(`${path}.${key} must be an object when provided`);
    return undefined;
  }

  return item;
}

function requireArray(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[],
): readonly unknown[] | undefined {
  const item = value[key];

  if (!isUnknownArray(item)) {
    issues.push(`${path}.${key} must be an array`);
    return undefined;
  }

  return item;
}

function optionalArray(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[],
): readonly unknown[] | undefined {
  const item = value[key];

  if (item === undefined) {
    return undefined;
  }

  if (!isUnknownArray(item)) {
    issues.push(`${path}.${key} must be an array when provided`);
    return undefined;
  }

  return item;
}

function requireStringArray(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[],
): void {
  const item = requireArray(value, key, path, issues);
  if (item === undefined) {
    return;
  }

  if (item.some((entry) => typeof entry !== 'string' || entry.length === 0)) {
    issues.push(`${path}.${key} must contain only non-empty strings`);
  }
}

function validateOptionalStringArray(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[],
): void {
  const item = optionalArray(value, key, path, issues);
  if (item === undefined) {
    return;
  }

  if (item.some((entry) => typeof entry !== 'string' || entry.length === 0)) {
    issues.push(`${path}.${key} must contain only non-empty strings when provided`);
  }
}

function validateNumberArray(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[],
): void {
  const item = requireArray(value, key, path, issues);
  if (item === undefined) {
    return;
  }

  if (item.length === 0) {
    issues.push(`${path}.${key} must include at least one number`);
  }

  if (item.some((entry) => typeof entry !== 'number' || !Number.isFinite(entry))) {
    issues.push(`${path}.${key} must contain only finite numbers`);
  }
}

function validateOptionalConfidence(
  value: Record<string, unknown>,
  path: string,
  issues: string[],
): void {
  const confidence = value.confidence;

  if (confidence === undefined) {
    return;
  }

  if (
    typeof confidence !== 'number' ||
    !Number.isFinite(confidence) ||
    confidence < 0 ||
    confidence > 1
  ) {
    issues.push(`${path}.confidence must be a finite number between 0 and 1 when provided`);
  }
}

function validateOptionalJsonObject(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: string[],
): void {
  const item = value[key];

  if (item === undefined) {
    return;
  }

  if (!isJsonObject(item)) {
    issues.push(`${path}.${key} must be a JSON object when provided`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function isAllowedStringLiteral(
  value: unknown,
  expected: readonly AllowedStringLiteral[],
): value is AllowedStringLiteral {
  return typeof value === 'string' && expected.includes(value as AllowedStringLiteral);
}

function isJsonObject(value: unknown): value is JsonObject {
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return true;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  return isJsonObject(value);
}
