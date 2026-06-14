import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
  REPLAY_SNAPSHOT_SCHEMA_VERSION,
  ReplaySnapshotValidationError,
  isReplaySnapshot,
  parseReplaySnapshot,
  validateReplaySnapshot,
  type ReplaySnapshot,
} from '../src/index.js';

describe('replay snapshot schema', () => {
  it('accepts the valid v1 replay fixture', async () => {
    const fixture = await loadFixture('replay-snapshot.v1.valid.json');
    const snapshot = parseReplaySnapshot(fixture);

    expect(snapshot.schemaVersion).toBe(REPLAY_SNAPSHOT_SCHEMA_VERSION);
    expect(snapshot.frames).toHaveLength(1);
    expect(snapshot.frames[0]?.streams[0]?.samples).toHaveLength(5);
    expect(isReplaySnapshot(snapshot)).toBe(true);
  });

  it('narrows valid unknown input to ReplaySnapshot', async () => {
    const fixture: unknown = await loadFixture('replay-snapshot.v1.valid.json');

    expect(isReplaySnapshot(fixture)).toBe(true);

    if (isReplaySnapshot(fixture)) {
      const snapshot: ReplaySnapshot = fixture;
      expect(snapshot.score.scoreId).toBe('weather-pressure');
    }
  });

  it('rejects the invalid v1 replay fixture with path-specific issues', async () => {
    const fixture = await loadFixture('replay-snapshot.v1.invalid.json');
    const issues = validateReplaySnapshot(fixture);

    expect(issues).toEqual(
      expect.arrayContaining([
        '$.schemaVersion must be replay-snapshot.v1',
        '$.snapshotId must be a non-empty string',
        '$.createdAt must be a parseable timestamp',
        '$.score.deterministic must be true',
        '$.frames[0].frameIndex must be greater than or equal to 0',
        '$.frames[0].streams[0].samples[0].value must be a finite number',
        '$.frames[0].output.visual.parameters[0].value must be between min and max',
      ]),
    );
    expect(() => parseReplaySnapshot(fixture)).toThrow(ReplaySnapshotValidationError);
    expect(isReplaySnapshot(fixture)).toBe(false);
  });

  it('rejects frame outputs that disagree with snapshot score and frame context', async () => {
    const fixture = structuredClone(
      await loadFixture('replay-snapshot.v1.valid.json'),
    ) as MutableReplayFixture;
    const output = fixture.frames[0]?.output;

    if (output === undefined) {
      throw new Error('valid replay fixture must include an output');
    }

    output.scoreId = 'different-score';
    output.scoreVersion = '2.0.0';
    output.frameIndex = 1;

    expect(validateReplaySnapshot(fixture)).toEqual(
      expect.arrayContaining([
        '$.frames[0].output.scoreId must match $.score.scoreId',
        '$.frames[0].output.scoreVersion must match $.score.scoreVersion',
        '$.frames[0].output.frameIndex must match the enclosing frameIndex',
      ]),
    );
  });
});

interface MutableReplayFixture {
  score: {
    scoreId: string;
    scoreVersion: string;
  };
  frames: {
    frameIndex: number;
    output?: {
      scoreId: string;
      scoreVersion: string;
      frameIndex: number;
    };
  }[];
}

async function loadFixture(name: string): Promise<unknown> {
  const contents = await readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
  return JSON.parse(contents) as unknown;
}
