import {
  SCORE_INPUT_SCHEMA_VERSION,
  clamp,
  parseReplaySnapshot,
  type NormalizedStreamState,
  type ReplayFrame,
  type ReplaySnapshot,
  type ScoreOutput,
} from '@world-instrument/core';
import { weatherScoreV1 } from '@world-instrument/scores';

import {
  mapScoreOutputToVisualParameters,
  type InstrumentVisualParameters,
} from './visualParameters.ts';
import openMeteoLondonScoreV1Replay from './replays/open-meteo-london-score-v1.replay.json';

const REPLAY_ACCELERATION = 60;
const MIN_REPLAY_DELAY_MS = 450;
const MAX_REPLAY_DELAY_MS = 1_600;

export interface WeatherReplayArchiveEntry {
  readonly id: string;
  readonly label: string;
  readonly snapshot: ReplaySnapshot;
}

export interface WeatherInstrumentState {
  readonly visualParameters: InstrumentVisualParameters;
  readonly sourceLabel: string;
  readonly replayLabel: string;
  readonly snapshotId: string;
  readonly frameIndex: number;
  readonly frameCount: number;
  readonly elapsedMs: number;
  readonly durationMs: number;
  readonly scoreSignature: string;
}

const openMeteoLondonReplay = parseReplaySnapshot(openMeteoLondonScoreV1Replay);

export const WEATHER_REPLAY_ARCHIVE = [
  {
    id: 'open-meteo-london-score-v1',
    label: 'London weather archive',
    snapshot: openMeteoLondonReplay,
  },
] satisfies readonly [WeatherReplayArchiveEntry, ...WeatherReplayArchiveEntry[]];

export const DEFAULT_WEATHER_REPLAY = WEATHER_REPLAY_ARCHIVE[0];

export function evaluateWeatherReplayFrame(
  snapshot: ReplaySnapshot,
  requestedFrameIndex: number,
): WeatherInstrumentState {
  assertSupportedWeatherReplay(snapshot);

  const frameIndex = clampReplayFrameIndex(snapshot, requestedFrameIndex);
  const frame = replayFrameAt(snapshot, frameIndex);
  const output = weatherScoreV1.evaluate({
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
  const source = weatherSourceForFrame(frame);

  return {
    visualParameters: mapScoreOutputToVisualParameters(output),
    sourceLabel: source.source.label ?? source.source.id,
    replayLabel: replayLabel(snapshot),
    snapshotId: snapshot.snapshotId,
    frameIndex,
    frameCount: snapshot.frames.length,
    elapsedMs: frame.elapsedMs,
    durationMs: replayDurationMs(snapshot),
    scoreSignature: scoreSignature(output),
  };
}

export function evaluateWeatherReplaySequence(
  snapshot: ReplaySnapshot,
): readonly WeatherInstrumentState[] {
  return snapshot.frames.map((_, frameIndex) => evaluateWeatherReplayFrame(snapshot, frameIndex));
}

export function loadFixtureWeatherInstrumentState(): Promise<WeatherInstrumentState> {
  return Promise.resolve(evaluateWeatherReplayFrame(DEFAULT_WEATHER_REPLAY.snapshot, 0));
}

export function clampReplayFrameIndex(snapshot: ReplaySnapshot, requestedFrameIndex: number): number {
  const lastFrameIndex = snapshot.frames.length - 1;

  if (!Number.isFinite(requestedFrameIndex)) {
    return 0;
  }

  return Math.round(clamp(requestedFrameIndex, 0, lastFrameIndex));
}

export function nextReplayFrameIndex(snapshot: ReplaySnapshot, currentFrameIndex: number): number {
  return clampReplayFrameIndex(snapshot, currentFrameIndex + 1);
}

export function previousReplayFrameIndex(snapshot: ReplaySnapshot, currentFrameIndex: number): number {
  return clampReplayFrameIndex(snapshot, currentFrameIndex - 1);
}

export function replayPlaybackDelayMs(snapshot: ReplaySnapshot, currentFrameIndex: number): number {
  const currentFrame = replayFrameAt(snapshot, clampReplayFrameIndex(snapshot, currentFrameIndex));
  const nextFrame = snapshot.frames[currentFrame.frameIndex + 1];

  if (nextFrame === undefined) {
    return 0;
  }

  return Math.round(
    clamp(
      (nextFrame.elapsedMs - currentFrame.elapsedMs) / REPLAY_ACCELERATION,
      MIN_REPLAY_DELAY_MS,
      MAX_REPLAY_DELAY_MS,
    ),
  );
}

function assertSupportedWeatherReplay(snapshot: ReplaySnapshot): void {
  if (
    snapshot.score.scoreId !== weatherScoreV1.metadata.scoreId ||
    snapshot.score.scoreVersion !== weatherScoreV1.metadata.scoreVersion
  ) {
    throw new Error(
      `Replay ${snapshot.snapshotId} targets ${snapshot.score.scoreId}@${snapshot.score.scoreVersion}, not ${weatherScoreV1.metadata.scoreId}@${weatherScoreV1.metadata.scoreVersion}`,
    );
  }
}

function replayFrameAt(snapshot: ReplaySnapshot, frameIndex: number): ReplayFrame {
  const frame = snapshot.frames[frameIndex];

  if (frame === undefined) {
    throw new Error(`Replay ${snapshot.snapshotId} does not include frame ${String(frameIndex)}`);
  }

  return frame;
}

function weatherSourceForFrame(frame: ReplayFrame): NormalizedStreamState {
  const stream =
    frame.streams.find((entry) => entry.source.kind === 'weather') ??
    frame.streams.find((entry) => entry.streamId.startsWith('weather:')) ??
    frame.streams[0];

  if (stream === undefined) {
    throw new Error(`Replay frame ${String(frame.frameIndex)} does not include a weather stream`);
  }

  return stream;
}

function replayLabel(snapshot: ReplaySnapshot): string {
  const title = snapshot.metadata?.title;

  return typeof title === 'string' && title.length > 0 ? title : snapshot.score.displayName;
}

function replayDurationMs(snapshot: ReplaySnapshot): number {
  const lastFrame = snapshot.frames[snapshot.frames.length - 1];

  return lastFrame?.elapsedMs ?? 0;
}

function scoreSignature(output: ScoreOutput): string {
  return output.trace?.find((entry) => entry.key === 'inputHash')?.value ?? output.scoreId;
}
