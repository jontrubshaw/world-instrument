import { describe, expect, it } from 'vitest';

import {
  createReplayScoreSequence,
  evaluateReplayFrame,
  importReplayArchiveFromJson,
  loadReplayArchives,
  replayArchiveSourceKinds,
  ReplayArchiveImportError,
  type ReplayArchive,
} from '../src/replayArchive.ts';
import {
  appendCapturedReplayFrame,
  buildReplaySnapshot,
  createReplayCaptureSession,
  serializeReplaySnapshot,
  type ReplayCaptureFrameInput,
} from '../src/replayCapture.ts';

describe('instrument replay archive', () => {
  it('loads a local recorded weather archive with multiple replay frames', () => {
    const archive = firstReplayArchive();

    expect(archive.label).toBe('London weather archive');
    expect(archive.snapshot.frames).toHaveLength(3);
    expect(evaluateReplayFrame(archive, 0)).toMatchObject({
      archiveId: 'weather-london-archive',
      sourceLabel: 'London, UK weather',
      framePosition: 0,
      frameCount: 3,
      elapsedMs: 0,
      durationMs: 30000,
      audioParameters: {
        signature: '8f5c7a72',
        carrierFrequencyHz: 168.41,
        gain: 0.052,
      },
      hapticPattern: {
        signature: '8f5c7a72',
        enabled: true,
        pattern: [42],
      },
    });
  });

  it('routes every replay frame through the weather score path', () => {
    const archive = firstReplayArchive();
    const sequence = createReplayScoreSequence(archive);

    expect(sequence).toHaveLength(3);
    expect(sequence.map((output) => output.scoreId)).toEqual([
      'weather-score',
      'weather-score',
      'weather-score',
    ]);
    expect(sequence.map((output) => output.frameIndex)).toEqual([0, 1, 2]);
    expect(sequence.map((output) => output.metadata?.condition)).toEqual([
      'overcast',
      'clear',
      'rain',
    ]);
  });

  it('restarts the archive into the same deterministic score sequence', () => {
    const archive = firstReplayArchive();
    const firstRun = createReplayScoreSequence(archive).map(scoreSignature);
    const restartedRun = createReplayScoreSequence(archive).map(scoreSignature);

    expect(firstRun).toEqual(restartedRun);
    expect(firstRun[0]).toBe('8f5c7a72');
    expect(new Set(firstRun).size).toBe(3);
  });

  it('clamps scrub positions to available replay frames', () => {
    const archive = firstReplayArchive();

    expect(evaluateReplayFrame(archive, -10).framePosition).toBe(0);
    expect(evaluateReplayFrame(archive, 99)).toMatchObject({
      framePosition: 2,
      statusLabel: 'rain archive frame 3/3',
    });
  });

  it('imports an exported capture as a session-local replay archive', () => {
    const archive = firstReplayArchive();
    const session = createReplayCaptureSession({
      sessionId: 'captured-replay-import-round-trip',
      title: 'Captured replay import round trip',
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
    const importedArchive = importReplayArchiveFromJson(
      serializeReplaySnapshot(snapshot),
      'captured-round-trip.replay.json',
    );

    expect(importedArchive).toMatchObject({
      label: 'Imported: Captured replay import round trip (London, UK weather)',
      origin: 'imported',
      importedFilename: 'captured-round-trip.replay.json',
      provenanceLabel: 'London, UK weather',
    });
    expect(importedArchive.id).toMatch(
      /^imported-captured-replay-import-round-trip-captured-round-trip-replay-[0-9a-f]{8}$/,
    );
    expect(importedArchive.snapshot).toEqual(snapshot);
    expect(replayArchiveSourceKinds(importedArchive)).toEqual(['weather']);
    expect(createReplayScoreSequence(importedArchive)).toEqual(
      snapshot.frames.map((frame) => frame.output),
    );
    expect(evaluateReplayFrame(importedArchive, 2)).toMatchObject({
      archiveId: importedArchive.id,
      archiveLabel: 'Imported: Captured replay import round trip (London, UK weather)',
      sourceLabel: 'London, UK weather',
      framePosition: 2,
    });
  });

  it('rejects imported replay JSON that cannot be parsed or replayed', () => {
    const archive = firstReplayArchive();
    const session = appendCapturedReplayFrame(
      createReplayCaptureSession({
        sessionId: 'captured-unsupported-score',
        title: 'Captured unsupported score',
        startedAt: '2026-06-14T21:00:00.000Z',
      }),
      captureInputForReplayFrame(archive, 0),
    );
    const snapshot = buildReplaySnapshot(session, {
      createdAt: '2026-06-14T22:45:00.000Z',
    });
    const unsupportedScoreSnapshot = {
      ...snapshot,
      score: {
        ...snapshot.score,
        scoreId: 'unknown-score',
      },
      frames: snapshot.frames.map((frame) => ({
        frameIndex: frame.frameIndex,
        elapsedMs: frame.elapsedMs,
        capturedAt: frame.capturedAt,
        streams: frame.streams,
        seed: frame.seed,
      })),
    };

    expect(() => importReplayArchiveFromJson('{"schemaVersion":"old"}', 'old.replay.json')).toThrow(
      ReplayArchiveImportError,
    );
    expect(() =>
      importReplayArchiveFromJson(JSON.stringify(unsupportedScoreSnapshot), 'unknown.replay.json'),
    ).toThrow(/unknown-score/);
  });
});

function firstReplayArchive(): ReplayArchive {
  const archive = loadReplayArchives()[0];

  if (archive === undefined) {
    throw new Error('Expected at least one replay archive.');
  }

  return archive;
}

function scoreSignature(output: {
  readonly trace?: readonly { readonly key: string; readonly value: string }[];
}) {
  return output.trace?.find((entry) => entry.key === 'inputHash')?.value;
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
    elapsedMs: frame.elapsedMs,
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
