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
  type WeatherInstrumentState,
} from './weatherInstrument.ts';

export const REPLAY_PLAYBACK_INTERVAL_MS = 1800;

export interface ReplayArchive {
  readonly id: string;
  readonly label: string;
  readonly snapshot: ReplaySnapshot;
  readonly origin?: 'bundled' | 'imported';
  readonly importedFilename?: string;
  readonly provenanceLabel?: string;
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
      provenanceLabel: replayArchiveProvenanceLabel(snapshot),
    },
  ];
}

export class ReplayArchiveImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReplayArchiveImportError';
  }
}

export function importReplayArchiveFromJson(contents: string, filename: string): ReplayArchive {
  const parsed = parseReplayJson(contents);
  const snapshot = parseImportedSnapshot(parsed);
  const archive = {
    id: importedArchiveId(snapshot, filename, contents),
    label: importedArchiveLabel(snapshot),
    snapshot,
    origin: 'imported',
    importedFilename: filename,
    provenanceLabel: replayArchiveProvenanceLabel(snapshot),
  } satisfies ReplayArchive;

  validateReplayArchivePlayback(archive);

  return archive;
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

function parseReplayJson(contents: string): unknown {
  try {
    return JSON.parse(contents) as unknown;
  } catch {
    throw new ReplayArchiveImportError('Replay import failed: file is not valid JSON.');
  }
}

function parseImportedSnapshot(value: unknown): ReplaySnapshot {
  try {
    return parseReplaySnapshot(value);
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new ReplayArchiveImportError(`Replay import failed: ${error.message}`);
    }

    throw new ReplayArchiveImportError('Replay import failed: file is not a replay snapshot.');
  }
}

function validateReplayArchivePlayback(archive: ReplayArchive): void {
  try {
    createReplayScoreSequence(archive);
    evaluateReplayFrame(archive, 0);
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new ReplayArchiveImportError(`Replay import failed: ${error.message}`);
    }

    throw new ReplayArchiveImportError('Replay import failed: archive cannot be replayed.');
  }
}

function importedArchiveId(snapshot: ReplaySnapshot, filename: string, contents: string): string {
  return `imported-${safeId(snapshot.snapshotId)}-${safeId(filename)}-${hashString(contents)}`;
}

function importedArchiveLabel(snapshot: ReplaySnapshot): string {
  const title = metadataString(snapshot.metadata?.title, snapshot.snapshotId);
  const provenanceLabel = replayArchiveProvenanceLabel(snapshot);

  return `Imported: ${title}${provenanceLabel.length > 0 ? ` (${provenanceLabel})` : ''}`;
}

function replayArchiveProvenanceLabel(snapshot: ReplaySnapshot): string {
  const metadataSources: unknown = snapshot.metadata?.sources;
  const metadataSource: unknown = Array.isArray(metadataSources) ? metadataSources[0] : undefined;

  if (isRecord(metadataSource)) {
    const label = metadataString(metadataSource.label, '');

    if (label.length > 0) {
      return label;
    }
  }

  const firstStream = snapshot.frames[0]?.streams[0];

  return firstStream?.source.label ?? firstStream?.source.id ?? '';
}

function metadataString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeId(value: string): string {
  return value
    .replace(/\.[^.]+$/u, '')
    .replace(/[^0-9A-Za-z]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function hashString(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}
