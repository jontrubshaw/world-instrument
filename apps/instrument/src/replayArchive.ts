import {
  parseReplaySnapshot,
  type ReplayFrame,
  type ReplaySnapshot,
  type ScoreOutput,
} from '@world-instrument/core';

import recordedWeatherReplay from './replayArchives/weather-london.v1.replay.json';
import {
  evaluateWeatherInstrumentFrame,
  evaluateWeatherScore,
  type WeatherInstrumentState,
} from './weatherInstrument.ts';

export const REPLAY_PLAYBACK_INTERVAL_MS = 1800;

export interface ReplayArchive {
  readonly id: string;
  readonly label: string;
  readonly snapshot: ReplaySnapshot;
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
    },
  ];
}

export function evaluateReplayFrame(
  archive: ReplayArchive,
  requestedPosition: number,
): ReplayInstrumentFrameState {
  const framePosition = clampFramePosition(archive.snapshot, requestedPosition);
  const frame = frameAt(archive.snapshot, framePosition);
  const frameCount = archive.snapshot.frames.length;
  const durationMs = archive.snapshot.frames.at(-1)?.elapsedMs ?? frame.elapsedMs;
  const instrumentFrame = evaluateWeatherInstrumentFrame({
    frameIndex: frame.frameIndex,
    elapsedMs: frame.elapsedMs,
    capturedAt: frame.capturedAt,
    streams: frame.streams,
    seed: frame.seed,
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
  return archive.snapshot.frames.map(evaluateWeatherScore);
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
