import { describe, expect, it } from 'vitest';

import {
  REPLAY_SNAPSHOT_SCHEMA_VERSION,
  SCORE_INPUT_SCHEMA_VERSION,
  validateReplaySnapshot,
  type ReplaySnapshot,
  type ScoreInput,
  type ScoreOutput,
} from '@world-instrument/core';

import { WeatherPressureScore, weatherPressureScore } from '../src/index.js';

import weatherPressureInputFixture from './fixtures/weather-pressure-input.v1.json';
import weatherPressureOutputFixture from './fixtures/weather-pressure-output.v1.json';

const weatherPressureInput = weatherPressureInputFixture as ScoreInput;
const weatherPressureOutput = weatherPressureOutputFixture as ScoreOutput;

describe('weather-pressure score', () => {
  it('evaluates recorded weather fixtures deterministically against the golden output', () => {
    const score = new WeatherPressureScore();

    const first = score.evaluate(weatherPressureInput);
    const second = score.evaluate(weatherPressureInput);

    expect(weatherPressureInput.schemaVersion).toBe(SCORE_INPUT_SCHEMA_VERSION);
    expect(first).toEqual(second);
    expect(first).toEqual(weatherPressureOutput);
    expect(first.visual.parameters.every(parameterIsInBounds)).toBe(true);
    expect(first.audio?.parameters.every(parameterIsInBounds)).toBe(true);
  });

  it('produces output that validates inside a replay snapshot', () => {
    const output = weatherPressureScore.evaluate(weatherPressureInput);
    const capturedAt =
      weatherPressureInput.frame.renderedAt ??
      weatherPressureInput.streams[0]?.observedAt ??
      '1970-01-01T00:00:00.000Z';
    const replaySnapshot: ReplaySnapshot = {
      schemaVersion: REPLAY_SNAPSHOT_SCHEMA_VERSION,
      snapshotId: 'weather-pressure-golden-2026-06-14T20:00:00Z',
      createdAt: '2026-06-14T20:00:00.000Z',
      score: weatherPressureScore.metadata,
      frames: [
        {
          frameIndex: weatherPressureInput.frame.frameIndex,
          elapsedMs: weatherPressureInput.frame.elapsedMs,
          capturedAt,
          streams: weatherPressureInput.streams,
          seed: weatherPressureInput.seed,
          output,
        },
      ],
      metadata: {
        fixture: true,
      },
    };

    expect(validateReplaySnapshot(replaySnapshot)).toEqual([]);
  });
});

function parameterIsInBounds(parameter: {
  readonly value: number;
  readonly min: number;
  readonly max: number;
}) {
  return parameter.value >= parameter.min && parameter.value <= parameter.max;
}
