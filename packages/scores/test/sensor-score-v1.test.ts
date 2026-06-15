import { describe, expect, it } from 'vitest';

import { SCORE_INPUT_SCHEMA_VERSION, parseReplaySnapshot } from '@world-instrument/core';
import {
  createBrowserSensorFixturePayload,
  normalizeBrowserSensorPayload,
} from '@world-instrument/adapters';

import {
  SENSOR_SCORE_V1_ID,
  SENSOR_SCORE_V1_METADATA,
  SENSOR_SCORE_V1_VERSION,
  sensorScoreV1,
} from '../src/index.ts';

describe('sensor score v1', () => {
  it('publishes explicit deterministic score metadata', () => {
    expect(SENSOR_SCORE_V1_METADATA).toMatchObject({
      scoreId: SENSOR_SCORE_V1_ID,
      scoreVersion: SENSOR_SCORE_V1_VERSION,
      displayName: 'Sensor Score v1',
      deterministic: true,
      supportedStreamSchemas: ['stream-state.v1'],
    });
  });

  it('maps identical browser sensor frames to identical output', () => {
    const stream = normalizeBrowserSensorPayload(
      createBrowserSensorFixturePayload({
        motion: [0.2, 0.1, 9.8],
        orientation: [30, 8, -12],
        pressure: 0.5,
      }),
    );
    const input = {
      schemaVersion: SCORE_INPUT_SCHEMA_VERSION,
      score: sensorScoreV1.metadata,
      frame: {
        frameIndex: 0,
        elapsedMs: 0,
        renderedAt: stream.observedAt,
      },
      streams: [stream],
      seed: 'sensor-score-test-seed',
    };

    expect(sensorScoreV1.evaluate(input)).toEqual(sensorScoreV1.evaluate(input));
    expect(sensorScoreV1.evaluate(input)).toMatchObject({
      scoreId: 'sensor-score',
      scoreVersion: '1.0.0',
      visual: {
        palette: ['#07111f', '#34d399', '#f97316'],
      },
      metadata: {
        condition: 'sensor-motion-active',
        capability: 'device-sensor',
      },
    });
  });

  it('produces replay-compatible sensor score output', () => {
    const stream = normalizeBrowserSensorPayload(createBrowserSensorFixturePayload(), {
      sequence: 2,
    });
    const output = sensorScoreV1.evaluate({
      schemaVersion: SCORE_INPUT_SCHEMA_VERSION,
      score: sensorScoreV1.metadata,
      frame: {
        frameIndex: 2,
        elapsedMs: 500,
        renderedAt: stream.observedAt,
      },
      streams: [stream],
      seed: 'sensor-score-replay-seed',
    });
    const snapshot = parseReplaySnapshot({
      schemaVersion: 'replay-snapshot.v1',
      snapshotId: 'sensor-score-replay-fixture',
      createdAt: '2026-06-15T12:05:02.000Z',
      score: sensorScoreV1.metadata,
      frames: [
        {
          frameIndex: 2,
          elapsedMs: 500,
          capturedAt: stream.observedAt,
          streams: [stream],
          seed: 'sensor-score-replay-seed',
          output,
        },
      ],
    });

    expect(snapshot.frames[0]?.output).toEqual(output);
    expect(output.trace?.find((entry) => entry.key === 'condition')?.value).toBe(
      'sensor-pointer-active',
    );
  });
});
