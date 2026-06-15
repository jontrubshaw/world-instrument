import { parseReplaySnapshot, type JsonObject } from '@world-instrument/core';
import { describe, expect, it } from 'vitest';

import {
  appendCapturedReplayFrame,
  buildReplaySnapshot,
  createReplayCaptureSession,
  createReplayCaptureSessionId,
  createReplayDownloadFilename,
  serializeReplaySnapshot,
  type ReplayCaptureFrameInput,
} from '../src/replayCapture.ts';
import {
  createReplayScoreSequence,
  evaluateReplayFrame,
  loadReplayArchives,
  type ReplayArchive,
} from '../src/replayArchive.ts';

describe('instrument replay capture', () => {
  it('exports captured generated frames as a parser-compatible replay snapshot', () => {
    const archive = firstReplayArchive();
    const session = createReplayCaptureSession({
      sessionId: 'captured-replay-weather-2026-06-14T21-00-00Z',
      title: 'Captured replay validation',
      startedAt: '2026-06-14T21:00:00.000Z',
    });
    const capturedSession = [0, 1].reduce(
      (currentSession, position) =>
        appendCapturedReplayFrame(currentSession, captureInputForReplayFrame(archive, position)),
      session,
    );
    const snapshot = buildReplaySnapshot(capturedSession, {
      createdAt: '2026-06-14T22:45:00.000Z',
    });
    const parsed = parseReplaySnapshot(JSON.parse(serializeReplaySnapshot(snapshot)));

    expect(parsed).toEqual(snapshot);
    expect(parsed).toMatchObject({
      schemaVersion: 'replay-snapshot.v1',
      snapshotId: 'captured-replay-weather-2026-06-14T21-00-00Z',
      score: {
        scoreId: 'weather-score',
        scoreVersion: '1.0.0',
      },
      frames: [
        {
          frameIndex: 0,
          elapsedMs: 0,
          seed: 'weather-score-v1:london:0',
        },
        {
          frameIndex: 1,
          seed: 'weather-score-v1:london:1',
        },
      ],
    });
    expect(parsed.frames[1]?.elapsedMs).toBeGreaterThan(0);
    expect(parsed.frames.map((frame) => frame.output?.trace?.[0]?.value)).toEqual([
      '8f5c7a72',
      '6c2d4560',
    ]);
    expect(parsed.metadata).toMatchObject({
      fixture: false,
      mode: 'captured',
      capture: {
        frameCount: 2,
        sourceMode: 'replay',
      },
      score: {
        scoreId: 'weather-score',
        scoreVersion: '1.0.0',
      },
    });
    expect(metadataFrames(parsed.metadata)).toMatchObject([
      {
        frameIndex: 0,
        inputHash: '8f5c7a72',
        visualSignature: '8f5c7a72',
        sourceMode: 'replay',
      },
      {
        frameIndex: 1,
        inputHash: '6c2d4560',
        visualSignature: '6c2d4560',
        sourceMode: 'replay',
      },
    ]);
  });

  it('replays an exported capture into the same score sequence', () => {
    const archive = firstReplayArchive();
    const session = createReplayCaptureSession({
      sessionId: 'captured-replay-round-trip',
      title: 'Captured replay round trip',
      startedAt: '2026-06-14T21:00:00.000Z',
    });
    const capturedSession = [0, 1, 2].reduce(
      (currentSession, position) =>
        appendCapturedReplayFrame(currentSession, captureInputForReplayFrame(archive, position)),
      session,
    );
    const snapshot = buildReplaySnapshot(capturedSession, {
      createdAt: '2026-06-14T22:45:00.000Z',
    });
    const capturedArchive: ReplayArchive = {
      id: 'captured-replay-round-trip',
      label: 'Captured replay round trip',
      snapshot,
    };

    expect(createReplayScoreSequence(capturedArchive)).toEqual(
      snapshot.frames.map((frame) => frame.output),
    );
    expect(
      createReplayScoreSequence(capturedArchive).map(
        (output) => output.trace?.find((entry) => entry.key === 'inputHash')?.value,
      ),
    ).toEqual(['8f5c7a72', '6c2d4560', '6247890f']);
  });

  it('creates stable capture ids and replay JSON filenames', () => {
    const sessionId = createReplayCaptureSessionId('2026-06-14T21:05:00.000Z', 'live');
    const session = appendCapturedReplayFrame(
      createReplayCaptureSession({
        sessionId,
        title: 'Captured live weather session',
        startedAt: '2026-06-14T21:05:00.000Z',
      }),
      captureInputForReplayFrame(firstReplayArchive(), 0),
    );
    const snapshot = buildReplaySnapshot(session, {
      createdAt: '2026-06-14T21:06:00.000Z',
    });

    expect(sessionId).toBe('captured-live-weather-2026-06-14T21-05-00Z');
    expect(createReplayDownloadFilename(snapshot)).toBe(
      'world-instrument-captured-live-weather-2026-06-14T21-05-00Z.replay.json',
    );
  });
});

function firstReplayArchive(): ReplayArchive {
  const archive = loadReplayArchives()[0];

  if (archive === undefined) {
    throw new Error('Expected at least one replay archive.');
  }

  return archive;
}

function captureInputForReplayFrame(
  archive: ReplayArchive,
  position: number,
): ReplayCaptureFrameInput {
  const frame = archive.snapshot.frames[position];
  const instrumentState = evaluateReplayFrame(archive, position);

  if (frame === undefined) {
    throw new Error(`Expected replay frame ${String(position)}.`);
  }

  return {
    sourceMode: 'replay',
    frameIndex: instrumentState.frameIndex,
    capturedAt: frame.capturedAt,
    streams: frame.streams,
    seed: frame.seed,
    output: instrumentState.output,
    visualSignature: instrumentState.visualParameters.signature,
    audioSignature: instrumentState.audioParameters.signature,
    hapticSignature: instrumentState.hapticPattern.signature,
    sourceLabel: instrumentState.sourceLabel,
    statusLabel: instrumentState.statusLabel,
  };
}

function metadataFrames(metadata: JsonObject | undefined): readonly JsonObject[] {
  const frames = metadata?.frames;

  if (!Array.isArray(frames)) {
    throw new Error('Expected captured frame metadata.');
  }

  return frames as readonly JsonObject[];
}
