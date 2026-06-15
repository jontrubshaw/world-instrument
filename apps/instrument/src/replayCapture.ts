import {
  REPLAY_SNAPSHOT_SCHEMA_VERSION,
  parseReplaySnapshot,
  type JsonObject,
  type NormalizedStreamState,
  type ReplayFrame,
  type ReplaySnapshot,
  type ScoreOutput,
  type StreamSourceMode,
} from '@world-instrument/core';

import type { ReplayArchive, ReplayInstrumentFrameState } from './replayArchive.ts';
import { evaluateWeatherInstrumentFrame, scoreMetadataForOutput } from './weatherInstrument.ts';

export type ReplayCaptureSourceMode = StreamSourceMode;

export interface ReplayCaptureFrameInput {
  readonly sourceMode: ReplayCaptureSourceMode;
  readonly frameIndex: number;
  readonly capturedAt: string;
  readonly elapsedMs?: number;
  readonly streams: readonly NormalizedStreamState[];
  readonly seed: string;
  readonly output: ScoreOutput;
  readonly visualSignature: string;
  readonly audioSignature: string;
  readonly hapticSignature: string;
  readonly sourceLabel?: string;
  readonly statusLabel?: string;
}

export interface CapturedReplayFrame extends ReplayCaptureFrameInput {
  readonly elapsedMs: number;
}

export interface ReplayCaptureSession {
  readonly sessionId: string;
  readonly title: string;
  readonly startedAt: string;
  readonly stoppedAt?: string;
  readonly status: 'recording' | 'ready';
  readonly frames: readonly CapturedReplayFrame[];
}

export interface CreateReplayCaptureSessionOptions {
  readonly sessionId: string;
  readonly title: string;
  readonly startedAt: string;
}

export interface CreateReplayCaptureSessionForFrameOptions {
  readonly startedAt: string;
  readonly frame: ReplayCaptureFrameInput;
}

export interface BuildReplaySnapshotOptions {
  readonly createdAt: string;
  readonly description?: string;
}

export interface CreateReplayCaptureFrameFromArchiveOptions {
  readonly archive: ReplayArchive;
  readonly viewState: ReplayInstrumentFrameState;
}

export function createReplayCaptureSession(
  options: CreateReplayCaptureSessionOptions,
): ReplayCaptureSession {
  return {
    sessionId: options.sessionId,
    title: options.title,
    startedAt: options.startedAt,
    status: 'recording',
    frames: [],
  };
}

export function createReplayCaptureSessionForFrame(
  options: CreateReplayCaptureSessionForFrameOptions,
): ReplayCaptureSession {
  const sourceKind = captureSourceKind(options.frame);
  const sourceLabel = options.frame.sourceLabel ?? sourceKind;

  return createReplayCaptureSession({
    sessionId: createReplayCaptureSessionId(
      options.startedAt,
      options.frame.sourceMode,
      sourceKind,
    ),
    title:
      options.frame.sourceMode === 'replay'
        ? `${sourceLabel} generated replay capture`
        : `${sourceLabel} ${options.frame.sourceMode} session`,
    startedAt: options.startedAt,
  });
}

export function stopReplayCaptureSession(
  session: ReplayCaptureSession,
  stoppedAt: string,
): ReplayCaptureSession {
  return {
    ...session,
    stoppedAt,
    status: 'ready',
  };
}

export function appendCapturedReplayFrame(
  session: ReplayCaptureSession,
  frame: ReplayCaptureFrameInput,
): ReplayCaptureSession {
  const elapsedMs = frame.elapsedMs ?? elapsedFromSessionStart(session.startedAt, frame.capturedAt);

  return {
    ...session,
    frames: [
      ...session.frames,
      {
        ...frame,
        elapsedMs,
      },
    ],
  };
}

export function prepareFrameForCaptureClock(
  session: ReplayCaptureSession,
  frame: ReplayCaptureFrameInput,
  capturedAt: string,
): ReplayCaptureFrameInput {
  if (frame.sourceMode === 'replay') {
    return frame;
  }

  const elapsedMs = elapsedFromSessionStart(session.startedAt, capturedAt);
  const rescoredFrame = evaluateWeatherInstrumentFrame({
    frameIndex: frame.frameIndex,
    elapsedMs,
    capturedAt,
    streams: frame.streams,
    seed: frame.seed,
    ...(frame.sourceLabel === undefined ? {} : { sourceLabel: frame.sourceLabel }),
    ...(frame.statusLabel === undefined ? {} : { statusLabel: frame.statusLabel }),
  });

  return {
    ...frame,
    capturedAt,
    elapsedMs,
    output: rescoredFrame.output,
    visualSignature: rescoredFrame.visualParameters.signature,
    audioSignature: rescoredFrame.audioParameters.signature,
    hapticSignature: rescoredFrame.hapticPattern.signature,
  };
}

export function createReplayCaptureFrameFromArchive(
  options: CreateReplayCaptureFrameFromArchiveOptions,
): ReplayCaptureFrameInput | undefined {
  const replayFrame = options.archive.snapshot.frames[options.viewState.framePosition];

  if (replayFrame === undefined) {
    return undefined;
  }

  return {
    sourceMode: 'replay',
    frameIndex: options.viewState.frameIndex,
    capturedAt: replayFrame.capturedAt,
    elapsedMs: replayFrame.elapsedMs,
    streams: replayFrame.streams,
    seed: replayFrame.seed,
    output: options.viewState.output,
    visualSignature: options.viewState.visualParameters.signature,
    audioSignature: options.viewState.audioParameters.signature,
    hapticSignature: options.viewState.hapticPattern.signature,
    sourceLabel: options.viewState.sourceLabel,
    statusLabel: options.viewState.statusLabel,
  };
}

export function buildReplaySnapshot(
  session: ReplayCaptureSession,
  options: BuildReplaySnapshotOptions,
): ReplaySnapshot {
  const frames = session.frames.map(toReplayFrame);
  const score = scoreMetadataForOutput(session.frames[0]?.output);
  const snapshot = {
    schemaVersion: REPLAY_SNAPSHOT_SCHEMA_VERSION,
    snapshotId: session.sessionId,
    createdAt: options.createdAt,
    score,
    frames,
    metadata: buildSnapshotMetadata(session, options),
  } satisfies ReplaySnapshot;

  return parseReplaySnapshot(snapshot);
}

export function serializeReplaySnapshot(snapshot: ReplaySnapshot): string {
  return `${JSON.stringify(parseReplaySnapshot(snapshot), null, 2)}\n`;
}

export function createReplayCaptureSessionId(
  startedAt: string,
  sourceMode: ReplayCaptureSourceMode,
  sourceKind = 'weather',
): string {
  const timestamp = startedAt.replace(/\.\d{3}Z$/, 'Z').replace(/[^0-9A-Za-z]+/g, '-');
  const safeSourceKind = sourceKind.replace(/[^0-9A-Za-z]+/g, '-').toLowerCase();

  return `captured-${sourceMode}-${safeSourceKind}-${timestamp}`;
}

export function createReplayDownloadFilename(snapshot: ReplaySnapshot): string {
  return `world-instrument-${snapshot.snapshotId.replace(/[^0-9A-Za-z.-]+/g, '-')}.replay.json`;
}

export function replayCaptureFrameKey(frame: ReplayCaptureFrameInput): string {
  const streamKeys = frame.streams
    .map((stream) => `${stream.streamId}:${String(stream.sequence)}:${stream.observedAt}`)
    .join(',');

  return [
    frame.sourceMode,
    frame.frameIndex,
    frame.capturedAt,
    frame.seed,
    frame.visualSignature,
    streamKeys,
  ].join('|');
}

function toReplayFrame(frame: CapturedReplayFrame): ReplayFrame {
  return {
    frameIndex: frame.frameIndex,
    elapsedMs: frame.elapsedMs,
    capturedAt: frame.capturedAt,
    seed: frame.seed,
    streams: frame.streams,
    output: frame.output,
  };
}

function buildSnapshotMetadata(
  session: ReplayCaptureSession,
  options: BuildReplaySnapshotOptions,
): JsonObject {
  const score = scoreMetadataForOutput(session.frames[0]?.output);

  return {
    fixture: false,
    mode: 'captured',
    title: session.title,
    description:
      options.description ??
      'Captured World Instrument session with normalized stream state and score output.',
    capture: {
      sessionId: session.sessionId,
      status: session.status,
      startedAt: session.startedAt,
      ...(session.stoppedAt === undefined ? {} : { stoppedAt: session.stoppedAt }),
      frameCount: session.frames.length,
      sourceMode: sourceModeSummary(session.frames),
    },
    score: {
      scoreId: score.scoreId,
      scoreVersion: score.scoreVersion,
      displayName: score.displayName,
    },
    sources: sourceMetadata(session.frames),
    frames: session.frames.map(frameMetadata),
  };
}

function frameMetadata(frame: CapturedReplayFrame): JsonObject {
  return {
    frameIndex: frame.frameIndex,
    elapsedMs: frame.elapsedMs,
    capturedAt: frame.capturedAt,
    seed: frame.seed,
    sourceMode: frame.sourceMode,
    sourceLabel: frame.sourceLabel ?? 'Weather stream',
    statusLabel: frame.statusLabel ?? 'Captured frame',
    inputHash: traceValue(frame.output, 'inputHash') ?? '',
    condition: traceValue(frame.output, 'condition') ?? '',
    visualSignature: frame.visualSignature,
    audioSignature: frame.audioSignature,
    hapticSignature: frame.hapticSignature,
    streams: frame.streams.map((stream) => ({
      streamId: stream.streamId,
      sourceId: stream.source.id,
      sourceKind: stream.source.kind,
      sourceLabel: stream.source.label ?? '',
      sourceUri: stream.source.uri ?? '',
      status: stream.status,
      observedAt: stream.observedAt,
      receivedAt: stream.receivedAt,
      sequence: stream.sequence,
    })),
  };
}

function sourceMetadata(frames: readonly CapturedReplayFrame[]): readonly JsonObject[] {
  const sources = new Map<string, JsonObject>();

  frames.forEach((frame) => {
    frame.streams.forEach((stream) => {
      const key = `${stream.streamId}|${stream.source.id}`;

      if (sources.has(key)) {
        return;
      }

      sources.set(key, {
        streamId: stream.streamId,
        sourceId: stream.source.id,
        kind: stream.source.kind,
        label: stream.source.label ?? '',
        uri: stream.source.uri ?? '',
      });
    });
  });

  return [...sources.values()];
}

function sourceModeSummary(frames: readonly CapturedReplayFrame[]): string {
  const modes = new Set(frames.map((frame) => frame.sourceMode));

  if (modes.size === 1) {
    return [...modes][0] ?? 'unknown';
  }

  return 'mixed';
}

function captureSourceKind(frame: ReplayCaptureFrameInput): string {
  return frame.streams[0]?.source.kind ?? 'stream';
}

function elapsedFromSessionStart(startedAt: string, capturedAt: string): number {
  const startedAtMs = Date.parse(startedAt);
  const capturedAtMs = Date.parse(capturedAt);

  if (Number.isNaN(startedAtMs) || Number.isNaN(capturedAtMs)) {
    return 0;
  }

  return Math.max(0, capturedAtMs - startedAtMs);
}

function traceValue(output: ScoreOutput, key: string): string | undefined {
  return output.trace?.find((entry) => entry.key === key)?.value;
}
