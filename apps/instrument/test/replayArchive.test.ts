import { describe, expect, it } from 'vitest';

import {
  createDeterministicBrowserSensorSnapshot,
  normalizeBrowserSensorPayload,
} from '@world-instrument/adapters';
import { browserSensorScoreV1 } from '@world-instrument/scores';

import {
  createReplayScoreSequence,
  evaluateReplayFrame,
  loadReplayArchives,
  type ReplayArchive,
} from '../src/replayArchive.ts';

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

  it('routes browser sensor replay archives through the browser sensor score path', () => {
    const archive = browserSensorArchive();
    const sequence = createReplayScoreSequence(archive);

    expect(sequence).toHaveLength(1);
    expect(sequence[0]).toEqual(archive.snapshot.frames[0]?.output);
    expect(evaluateReplayFrame(archive, 0)).toMatchObject({
      archiveId: 'browser-sensor-test-archive',
      sourceLabel: 'Studio browser sensor',
      visualParameters: {
        scoreId: 'browser-sensor-score',
        condition: 'sensor-touch',
      },
      audioParameters: {
        scoreId: 'browser-sensor-score',
      },
      hapticPattern: {
        scoreId: 'browser-sensor-score',
      },
    });
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

function browserSensorArchive(): ReplayArchive {
  const stream = normalizeBrowserSensorPayload(
    createDeterministicBrowserSensorSnapshot({
      observedAt: '2026-06-15T12:00:00.000Z',
    }),
  );
  const output = browserSensorScoreV1.evaluate({
    schemaVersion: 'score-input.v1',
    score: browserSensorScoreV1.metadata,
    frame: {
      frameIndex: 0,
      elapsedMs: 0,
      renderedAt: '2026-06-15T12:00:00.000Z',
    },
    streams: [stream],
    seed: 'browser-sensor-score-v1:fixture:0',
  });

  return {
    id: 'browser-sensor-test-archive',
    label: 'Browser sensor test archive',
    snapshot: {
      schemaVersion: 'replay-snapshot.v1',
      snapshotId: 'browser-sensor-test-archive',
      createdAt: '2026-06-15T12:00:05.000Z',
      score: browserSensorScoreV1.metadata,
      frames: [
        {
          frameIndex: 0,
          elapsedMs: 0,
          capturedAt: '2026-06-15T12:00:00.000Z',
          streams: [stream],
          output,
          seed: 'browser-sensor-score-v1:fixture:0',
        },
      ],
    },
  };
}
