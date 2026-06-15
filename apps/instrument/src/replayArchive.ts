import {
  SCORE_INPUT_SCHEMA_VERSION,
  parseReplaySnapshot,
  type ReplayFrame,
  type ReplaySnapshot,
  type ScoreOutput,
} from '@world-instrument/core';
import { weatherScoreV1 } from '@world-instrument/scores';

import {
  mapScoreOutputToAudioParameters,
  type InstrumentAudioParameters,
} from './audioParameters.ts';
import {
  mapScoreOutputToHapticPattern,
  type InstrumentHapticPattern,
} from './hapticParameters.ts';
import recordedWeatherReplay from './replayArchives/weather-london.v1.replay.json';
import {
  mapScoreOutputToVisualParameters,
  type InstrumentVisualParameters,
} from './visualParameters.ts';

export const REPLAY_PLAYBACK_INTERVAL_MS = 1800;

export interface ReplayArchive {
  readonly id: string;
  readonly label: string;
  readonly snapshot: ReplaySnapshot;
}

export interface ReplayInstrumentFrameState {
  readonly archiveId: string;
  readonly archiveLabel: string;
  readonly framePosition: number;
  readonly frameCount: number;
  readonly elapsedMs: number;
  readonly durationMs: number;
  readonly sourceLabel: string;
  readonly statusLabel: string;
  readonly output: ScoreOutput;
  readonly visualParameters: InstrumentVisualParameters;
  readonly audioParameters: InstrumentAudioParameters;
  readonly hapticPattern: InstrumentHapticPattern;
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
  const output = evaluateWeatherScore(frame);
  const visualParameters = mapScoreOutputToVisualParameters(output);
  const audioParameters = mapScoreOutputToAudioParameters(output);
  const hapticPattern = mapScoreOutputToHapticPattern(output);
  const frameCount = archive.snapshot.frames.length;
  const durationMs = archive.snapshot.frames.at(-1)?.elapsedMs ?? frame.elapsedMs;

  return {
    archiveId: archive.id,
    archiveLabel: archive.label,
    framePosition,
    frameCount,
    elapsedMs: frame.elapsedMs,
    durationMs,
    sourceLabel: sourceLabel(frame),
    statusLabel: `${visualParameters.condition} archive frame ${String(framePosition + 1)}/${String(
      frameCount,
    )}`,
    output,
    visualParameters,
    audioParameters,
    hapticPattern,
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

function evaluateWeatherScore(frame: ReplayFrame): ScoreOutput {
  return weatherScoreV1.evaluate({
    schemaVersion: SCORE_INPUT_SCHEMA_VERSION,
    score: weatherScoreV1.metadata,
    frame: {
      frameIndex: frame.frameIndex,
      elapsedMs: frame.elapsedMs,
      renderedAt: frame.capturedAt,
    },
    streams: frame.streams,
    seed: frame.seed,
  });
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
