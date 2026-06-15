import { describe, expect, it } from 'vitest';

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

  it('routes every replay frame through deterministic audio planning', () => {
    const archive = firstReplayArchive();
    const plans = archive.snapshot.frames.map(
      (_, position) => evaluateReplayFrame(archive, position).audioPlan,
    );

    expect(plans.map((plan) => plan.frameIndex)).toEqual([0, 1, 2]);
    expect(plans.map((plan) => plan.signature)).toEqual(['8f5c7a72', '5fbe7b12', 'b5e05580']);
    expect(plans.map((plan) => plan.enabled)).toEqual([true, true, true]);
    expect(plans.map((plan) => plan.carrierFrequencyHz)).toEqual([211.562, 200.694, 232.945]);
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
