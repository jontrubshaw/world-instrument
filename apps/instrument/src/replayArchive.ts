import {
  parseReplaySnapshot,
  type ReplayFrame,
  type ReplaySnapshot,
  type ScoreOutput,
} from '@world-instrument/core';

import recordedWeatherReplay from './replayArchives/weather-london.v1.replay.json';
import {
  evaluateInstrumentFrame,
  evaluateInstrumentScore,
  resolveInstrumentScore,
  type WeatherInstrumentState,
} from './weatherInstrument.ts';

export const REPLAY_PLAYBACK_INTERVAL_MS = 1800;

export type ReplayArchiveOrigin = 'bundled' | 'imported';

export interface ReplayArchive {
  readonly id: string;
  readonly label: string;
  readonly snapshot: ReplaySnapshot;
  readonly origin: ReplayArchiveOrigin;
  readonly importedAt?: string;
  readonly importedFileName?: string;
}

export interface CreateImportedReplayArchiveOptions {
  readonly existingArchives?: readonly ReplayArchive[];
  readonly fileName?: string;
  readonly importedAt?: string;
}

export interface ReplayInstrumentFrameState extends WeatherInstrumentState {
  readonly archiveId: string;
  readonly archiveLabel: string;
  readonly framePosition: number;
  readonly frameCount: number;
  readonly durationMs: number;
}

export function loadReplayArchives(): readonly ReplayArchive[] {
  const snapshot = parseReplaySnapshot(recordedWeatherReplay);

  return [
    {
      id: 'weather-london-archive',
      label: metadataString(snapshot.metadata?.title, 'London weather archive'),
      snapshot,
      origin: 'bundled',
    },
  ];
}

export function createImportedReplayArchive(
  value: unknown,
  options: CreateImportedReplayArchiveOptions = {},
): ReplayArchive {
  const snapshot = parseReplaySnapshot(value);

  validateReplayArchiveForInstrument(snapshot);

  const label = `Imported: ${metadataString(snapshot.metadata?.title, snapshot.snapshotId)}`;
  const baseId = `imported-${safeArchiveId(snapshot.snapshotId)}`;

  return {
    id: uniqueArchiveId(baseId, options.existingArchives ?? []),
    label,
    snapshot,
    origin: 'imported',
    ...(options.importedAt === undefined ? {} : { importedAt: options.importedAt }),
    ...(options.fileName === undefined ? {} : { importedFileName: options.fileName }),
  };
}

export function evaluateReplayFrame(
  archive: ReplayArchive,
  requestedPosition: number,
): ReplayInstrumentFrameState {
  const framePosition = clampFramePosition(archive.snapshot, requestedPosition);
  const frame = frameAt(archive.snapshot, framePosition);
  const frameCount = archive.snapshot.frames.length;
  const durationMs = archive.snapshot.frames.at(-1)?.elapsedMs ?? frame.elapsedMs;
  const instrumentFrame = evaluateInstrumentFrame({
    frameIndex: frame.frameIndex,
    elapsedMs: frame.elapsedMs,
    capturedAt: frame.capturedAt,
    streams: frame.streams,
    seed: frame.seed,
    score: archive.snapshot.score,
    sourceLabel: sourceLabel(frame),
  });

  return {
    ...instrumentFrame,
    archiveId: archive.id,
    archiveLabel: archive.label,
    framePosition,
    frameCount,
    durationMs,
    statusLabel: `${instrumentFrame.visualParameters.condition} archive frame ${String(
      framePosition + 1,
    )}/${String(frameCount)}`,
  };
}

export function createReplayScoreSequence(archive: ReplayArchive): readonly ScoreOutput[] {
  return archive.snapshot.frames.map((frame) =>
    evaluateInstrumentScore({
      frameIndex: frame.frameIndex,
      elapsedMs: frame.elapsedMs,
      capturedAt: frame.capturedAt,
      streams: frame.streams,
      seed: frame.seed,
      score: archive.snapshot.score,
    }),
  );
}

export function replayArchiveSourceKinds(archive: ReplayArchive): readonly string[] {
  const sourceKinds = new Set<string>();

  archive.snapshot.frames.forEach((frame) => {
    frame.streams.forEach((stream) => {
      sourceKinds.add(stream.source.kind);
    });
  });

  return [...sourceKinds];
}

export function clampFramePosition(snapshot: ReplaySnapshot, requestedPosition: number): number {
  if (snapshot.frames.length === 0) {
    throw new Error('Replay archive must include at least one frame.');
  }

  return Math.min(Math.max(Math.round(requestedPosition), 0), snapshot.frames.length - 1);
}

function frameAt(snapshot: ReplaySnapshot, position: number): ReplayFrame {
  const frame = snapshot.frames[position];

  if (frame === undefined) {
    throw new Error(`Replay archive frame ${String(position)} is not available.`);
  }

  return frame;
}

function sourceLabel(frame: ReplayFrame): string {
  const stream = frame.streams[0];

  return stream?.source.label ?? stream?.source.id ?? 'Recorded stream';
}

function metadataString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function validateReplayArchiveForInstrument(snapshot: ReplaySnapshot): void {
  resolveInstrumentScore({ score: snapshot.score });

  try {
    evaluateInstrumentScore({
      frameIndex: snapshot.frames[0]?.frameIndex ?? 0,
      elapsedMs: snapshot.frames[0]?.elapsedMs ?? 0,
      capturedAt: snapshot.frames[0]?.capturedAt ?? snapshot.createdAt,
      streams: snapshot.frames[0]?.streams ?? [],
      seed: snapshot.frames[0]?.seed ?? snapshot.snapshotId,
      score: snapshot.score,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown score evaluation error';

    throw new Error(`Replay archive cannot be scored by this instrument: ${detail}`);
  }
}

function safeArchiveId(value: string): string {
  const safeId = value.replace(/[^0-9A-Za-z.-]+/g, '-').replace(/^-+|-+$/g, '');

  return safeId.length > 0 ? safeId : 'archive';
}

function uniqueArchiveId(baseId: string, existingArchives: readonly ReplayArchive[]): string {
  const existingIds = new Set(existingArchives.map((archive) => archive.id));

  if (!existingIds.has(baseId)) {
    return baseId;
  }

  let suffix = 2;
  let candidate = `${baseId}-${String(suffix)}`;

  while (existingIds.has(candidate)) {
    suffix += 1;
    candidate = `${baseId}-${String(suffix)}`;
  }

  return candidate;
}
