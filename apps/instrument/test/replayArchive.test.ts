import { describe, expect, it } from 'vitest';

import {
  createImportedReplayArchive,
  createReplayScoreSequence,
  evaluateReplayFrame,
  loadReplayArchives,
  replayArchiveSourceKinds,
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

  it('imports an exported capture as a playable in-memory replay archive', () => {
    const sourceArchive = firstReplayArchive();
    const session = createReplayCaptureSession({
      sessionId: 'captured-replay-import-round-trip',
      title: 'Captured replay import round trip',
      startedAt: '2026-06-15T20:00:00.000Z',
    });
    const capturedSession = [0, 1].reduce(
      (currentSession, position) =>
        appendCapturedReplayFrame(currentSession, captureInputForReplayFrame(sourceArchive, position)),
      session,
    );
    const snapshot = buildReplaySnapshot(capturedSession, {
      createdAt: '2026-06-15T20:05:00.000Z',
    });
    const importedArchive = createImportedReplayArchive(
      JSON.parse(serializeReplaySnapshot(snapshot)),
      {
        existingArchives: loadReplayArchives(),
        fileName: 'captured-replay-import-round-trip.replay.json',
        importedAt: '2026-06-15T20:06:00.000Z',
      },
    );

    expect(importedArchive).toMatchObject({
      id: 'imported-captured-replay-import-round-trip',
      label: 'Imported: Captured replay import round trip',
      origin: 'imported',
      importedAt: '2026-06-15T20:06:00.000Z',
      importedFileName: 'captured-replay-import-round-trip.replay.json',
    });
    expect(replayArchiveSourceKinds(importedArchive)).toEqual(['weather']);
    expect(createReplayScoreSequence(importedArchive)).toEqual(
      snapshot.frames.map((frame) => frame.output),
    );
    expect(evaluateReplayFrame(importedArchive, 1)).toMatchObject({
      archiveId: 'imported-captured-replay-import-round-trip',
      archiveLabel: 'Imported: Captured replay import round trip',
      sourceLabel: 'London, UK weather',
      framePosition: 1,
      frameCount: 2,
      visualParameters: {
        signature: '6c2d4560',
      },
    });
  });

  it('rejects invalid replay imports before adding them to the archive picker', () => {
    const sourceArchive = firstReplayArchive();
    const unknownScoreSnapshot = JSON.parse(
      JSON.stringify(sourceArchive.snapshot),
    ) as MutableReplaySnapshot;

    unknownScoreSnapshot.snapshotId = 'unknown-score-import';
    unknownScoreSnapshot.score.scoreId = 'unknown-score';
    unknownScoreSnapshot.score.displayName = 'Unknown Score';
    unknownScoreSnapshot.frames = unknownScoreSnapshot.frames.map((frame) => {
      const frameWithoutOutput = { ...frame };
      delete frameWithoutOutput.output;

      return frameWithoutOutput;
    });

    expect(() =>
      createImportedReplayArchive({
        schemaVersion: 'not-a-replay-snapshot',
      }),
    ).toThrow('Invalid replay snapshot');
    expect(() => createImportedReplayArchive(unknownScoreSnapshot)).toThrow(
      "Score 'unknown-score' version '1.0.0' is not registered in the instrument app.",
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

function scoreSignature(output: {
  readonly trace?: readonly { readonly key: string; readonly value: string }[];
}) {
  return output.trace?.find((entry) => entry.key === 'inputHash')?.value;
}

interface MutableReplaySnapshot {
  snapshotId: string;
  score: {
    scoreId: string;
    displayName: string;
  };
  frames: {
    readonly output?: unknown;
    readonly [key: string]: unknown;
  }[];
}
