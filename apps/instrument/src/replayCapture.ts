import {
  REPLAY_SNAPSHOT_SCHEMA_VERSION,
  parseReplaySnapshot,
  type JsonObject,
  type NormalizedStreamState,
  type ReplayFrame,
  type ReplaySnapshot,
  type ScoreOutput,
} from '@world-instrument/core';
import { weatherScoreV1 } from '@world-instrument/scores';

import { LIVE_WEATHER_SEED, type LiveWeatherInstrumentFrameState } from './liveWeather.ts';
import {
  REPLAY_PLAYBACK_INTERVAL_MS,
  clampFramePosition,
  type ReplayArchive,
} from './replayArchive.ts';

export const REPLAY_CAPTURE_VERSION = 'replay-capture.v1' as const;

export type ReplayCaptureMode = 'live' | 'replay';

export interface CapturedInstrumentFrame {
  readonly frame: ReplayFrame;
  readonly source: CapturedFrameSource;
}

export type CapturedFrameSource = CapturedLiveFrameSource | CapturedReplayFrameSource;

export interface CapturedLiveFrameSource {
  readonly mode: 'live';
  readonly status: LiveWeatherInstrumentFrameState['liveStatus'];
}

export interface CapturedReplayFrameSource {
  readonly mode: 'replay';
  readonly archiveId: string;
  readonly archiveLabel: string;
  readonly snapshotId: string;
  readonly framePosition: number;
}

export interface ReplaySnapshotExportOptions {
  readonly createdAt?: string;
  readonly snapshotId?: string;
  readonly title?: string;
}

export function createCapturedReplayFrame(
  archive: ReplayArchive,
  requestedPosition: number,
  output: ScoreOutput,
): CapturedInstrumentFrame {
  const framePosition = clampFramePosition(archive.snapshot, requestedPosition);
  const sourceFrame = archive.snapshot.frames[framePosition];

  if (sourceFrame === undefined) {
    throw new Error(`Replay archive frame ${String(framePosition)} is not available for capture.`);
  }

  return {
    frame: {
      frameIndex: sourceFrame.frameIndex,
      elapsedMs: sourceFrame.elapsedMs,
      capturedAt: sourceFrame.capturedAt,
      seed: sourceFrame.seed,
      streams: sourceFrame.streams,
      output,
    },
    source: {
      mode: 'replay',
      archiveId: archive.id,
      archiveLabel: archive.label,
      snapshotId: archive.snapshot.snapshotId,
      framePosition,
    },
  };
}

export function createCapturedLiveFrame(
  streamState: NormalizedStreamState,
  frameState: LiveWeatherInstrumentFrameState,
): CapturedInstrumentFrame {
  return {
    frame: {
      frameIndex: frameState.frameIndex,
      elapsedMs: frameState.elapsedMs,
      capturedAt: streamState.observedAt,
      seed: LIVE_WEATHER_SEED,
      streams: [streamState],
      output: frameState.output,
    },
    source: {
      mode: 'live',
      status: frameState.liveStatus,
    },
  };
}

export function appendCapturedFrame(
  capturedFrames: readonly CapturedInstrumentFrame[],
  nextFrame: CapturedInstrumentFrame,
): readonly CapturedInstrumentFrame[] {
  const lastFrame = capturedFrames.at(-1);

  if (lastFrame !== undefined && capturedFrameKey(lastFrame) === capturedFrameKey(nextFrame)) {
    return capturedFrames;
  }

  return [...capturedFrames, nextFrame];
}

export function createReplaySnapshotFromCapturedFrames(
  capturedFrames: readonly CapturedInstrumentFrame[],
  options: ReplaySnapshotExportOptions = {},
): ReplaySnapshot {
  if (capturedFrames.length === 0) {
    throw new Error('At least one captured frame is required to export a replay archive.');
  }

  const createdAt = options.createdAt ?? new Date().toISOString();
  const snapshotId =
    options.snapshotId ?? `generated-weather-session-${slugifyTimestamp(createdAt)}`;
  const frames = capturedFrames.map(({ frame }) => frame);
  const snapshot = {
    schemaVersion: REPLAY_SNAPSHOT_SCHEMA_VERSION,
    snapshotId,
    createdAt,
    score: weatherScoreV1.metadata,
    frames,
    metadata: createSnapshotMetadata(capturedFrames, options.title ?? 'Generated weather session'),
  } satisfies ReplaySnapshot;

  return parseReplaySnapshot(snapshot);
}

export function serializeReplaySnapshot(snapshot: ReplaySnapshot): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

export function replaySnapshotDownloadFilename(snapshot: ReplaySnapshot): string {
  return `${slugifySnapshotId(snapshot.snapshotId)}.replay.json`;
}

export function capturedFrameKey(capturedFrame: CapturedInstrumentFrame): string {
  const stream = capturedFrame.frame.streams[0];
  const outputHash = capturedFrame.frame.output?.trace?.find((entry) => entry.key === 'inputHash');

  return [
    capturedFrame.source.mode,
    capturedFrameSourceKey(capturedFrame.source),
    capturedFrame.frame.frameIndex,
    capturedFrame.frame.elapsedMs,
    capturedFrame.frame.capturedAt,
    capturedFrame.frame.seed,
    stream?.streamId ?? 'missing-stream',
    stream?.sequence ?? 'missing-sequence',
    outputHash?.value ?? 'missing-output-hash',
  ].join('|');
}

function createSnapshotMetadata(
  capturedFrames: readonly CapturedInstrumentFrame[],
  title: string,
): JsonObject {
  return {
    title,
    captureVersion: REPLAY_CAPTURE_VERSION,
    capturedBy: 'world-instrument.instrument-app',
    generatedFrom: 'instrument-session',
    frameCount: capturedFrames.length,
    replayPlaybackIntervalMs: REPLAY_PLAYBACK_INTERVAL_MS,
    modes: unique(capturedFrames.map((frame) => frame.source.mode)),
    sources: uniqueSources(capturedFrames),
    frameSources: capturedFrames.map(frameSourceMetadata),
  };
}

function frameSourceMetadata(capturedFrame: CapturedInstrumentFrame): JsonObject {
  const stream = capturedFrame.frame.streams[0];
  const baseMetadata: JsonObject = {
    mode: capturedFrame.source.mode,
    frameIndex: capturedFrame.frame.frameIndex,
    elapsedMs: capturedFrame.frame.elapsedMs,
    capturedAt: capturedFrame.frame.capturedAt,
    seed: capturedFrame.frame.seed,
    streamId: stream?.streamId ?? 'missing-stream',
    streamSequence: stream?.sequence ?? -1,
    streamStatus: stream?.status ?? 'error',
    sourceId: stream?.source.id ?? 'missing-source',
    sourceKind: stream?.source.kind ?? 'unknown',
  };

  if (capturedFrame.source.mode === 'live') {
    return {
      ...baseMetadata,
      liveStatus: capturedFrame.source.status,
    };
  }

  return {
    ...baseMetadata,
    archiveId: capturedFrame.source.archiveId,
    archiveLabel: capturedFrame.source.archiveLabel,
    archiveSnapshotId: capturedFrame.source.snapshotId,
    archiveFramePosition: capturedFrame.source.framePosition,
  };
}

function uniqueSources(capturedFrames: readonly CapturedInstrumentFrame[]): readonly JsonObject[] {
  const sources = new Map<string, JsonObject>();

  for (const capturedFrame of capturedFrames) {
    const stream = capturedFrame.frame.streams[0];

    if (stream === undefined) {
      continue;
    }

    const key = [
      capturedFrame.source.mode,
      stream.streamId,
      stream.source.id,
      capturedFrameSourceKey(capturedFrame.source),
    ].join('|');

    if (!sources.has(key)) {
      sources.set(key, {
        mode: capturedFrame.source.mode,
        streamId: stream.streamId,
        sourceId: stream.source.id,
        sourceKind: stream.source.kind,
        sourceLabel: stream.source.label ?? stream.source.id,
        ...(stream.source.uri === undefined ? {} : { sourceUri: stream.source.uri }),
      });
    }
  }

  return [...sources.values()];
}

function capturedFrameSourceKey(source: CapturedFrameSource): string {
  if (source.mode === 'live') {
    return source.status;
  }

  return `${source.archiveId}:${source.snapshotId}:${String(source.framePosition)}`;
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function slugifyTimestamp(timestamp: string): string {
  return timestamp.replaceAll(':', '').replaceAll('.', '').replaceAll('Z', 'z');
}

function slugifySnapshotId(snapshotId: string): string {
  return snapshotId
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '');
}
