import { describe, expect, it } from 'vitest';

import {
  REPLAY_SNAPSHOT_SCHEMA_VERSION,
  SCORE_INPUT_SCHEMA_VERSION,
  parseReplaySnapshot,
  type ReplaySnapshot,
} from '@world-instrument/core';
import {
  createDeterministicBrowserSensorSnapshot,
  normalizeBrowserSensorPayload,
  type RecordedBrowserSensorPayload,
} from '@world-instrument/adapters';

import {
  BROWSER_SENSOR_SCORE_V1_ID,
  BROWSER_SENSOR_SCORE_V1_METADATA,
  BROWSER_SENSOR_SCORE_V1_VERSION,
  browserSensorScoreV1,
} from '../src/index.ts';

describe('browser sensor score v1', () => {
  it('publishes explicit deterministic score metadata', () => {
    expect(BROWSER_SENSOR_SCORE_V1_METADATA).toMatchObject({
      scoreId: BROWSER_SENSOR_SCORE_V1_ID,
      scoreVersion: BROWSER_SENSOR_SCORE_V1_VERSION,
      displayName: 'Browser Sensor Score v1',
      deterministic: true,
      supportedStreamSchemas: ['stream-state.v1'],
      metadata: {
        inputKind: 'browser-sensor',
      },
    });
  });

  it('maps browser sensor fixtures through deterministic output parameters', () => {
    const stream = normalizeBrowserSensorPayload(sensorFixture, { sequence: 2 });
    const input = {
      schemaVersion: SCORE_INPUT_SCHEMA_VERSION,
      score: browserSensorScoreV1.metadata,
      frame: {
        frameIndex: 2,
        elapsedMs: 240,
        renderedAt: '2026-06-15T12:00:00.240Z',
      },
      streams: [stream],
      seed: 'world-instrument-test-sensor-v1',
    };

    const first = browserSensorScoreV1.evaluate(input);
    const second = browserSensorScoreV1.evaluate(input);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      scoreId: 'browser-sensor-score',
      scoreVersion: '1.0.0',
      frameIndex: 2,
      generatedAt: '2026-06-15T12:00:00.240Z',
      metadata: {
        streamStatus: 'ok',
        streamId: 'sensor:studio-browser',
        condition: 'sensor-touch',
        inputKind: 'browser-sensor',
      },
      audio: {
        enabled: true,
      },
      haptic: {
        enabled: false,
      },
    });
    expect(first.visual.parameters.map((parameter) => parameter.key)).toEqual([
      'warmth',
      'humidity',
      'wind',
      'precipitation',
      'pressure',
      'cloudCover',
      'motion',
      'diffusion',
      'tension',
      'brightness',
    ]);
    expect(first.trace?.find((entry) => entry.key === 'condition')).toEqual({
      key: 'condition',
      value: 'sensor-touch',
    });
  });

  it('adapts live pointer fallback snapshots without weather score coupling', () => {
    const stream = normalizeBrowserSensorPayload(
      {
        provider: sensorFixture.provider,
        observedAt: sensorFixture.observedAt,
        ...(sensorFixture.receivedAt === undefined ? {} : { receivedAt: sensorFixture.receivedAt }),
        device: sensorFixture.device,
        ...(sensorFixture.pointer === undefined ? {} : { pointer: sensorFixture.pointer }),
        capabilities: {
          pointer: 'available',
          deviceMotion: 'permission-required',
          deviceOrientation: 'unavailable',
          permission: 'not-requested',
          fallback: 'pointer',
        },
      },
      {
        mode: 'live',
        now: '2026-06-15T12:00:01.000Z',
        staleAfterMs: 3_000,
      },
    );

    const output = browserSensorScoreV1.evaluate({
      schemaVersion: SCORE_INPUT_SCHEMA_VERSION,
      score: browserSensorScoreV1.metadata,
      frame: {
        frameIndex: 3,
        elapsedMs: 360,
        renderedAt: '2026-06-15T12:00:01.000Z',
      },
      streams: [stream],
      seed: 'world-instrument-test-live-sensor-v1',
    });

    expect(stream).toMatchObject({
      status: 'degraded',
      metadata: {
        mode: 'live',
        activeInputs: ['pointer'],
      },
    });
    expect(output).toMatchObject({
      scoreId: BROWSER_SENSOR_SCORE_V1_ID,
      metadata: {
        condition: 'sensor-touch',
        inputKind: 'browser-sensor',
        streamStatus: 'degraded',
      },
    });
  });

  it('does not score a still gravity-removed accelerometer as sensor motion', () => {
    const stream = normalizeBrowserSensorPayload({
      provider: sensorFixture.provider,
      observedAt: sensorFixture.observedAt,
      device: sensorFixture.device,
      capabilities: {
        pointer: 'available',
        deviceMotion: 'available',
        deviceOrientation: 'unavailable',
        permission: 'granted',
        fallback: 'none',
      },
      pointer: {
        position: [0.5, 0.5],
        velocity: [0, 0],
        pressure: 0,
        buttons: 0,
        active: false,
      },
      motion: {
        acceleration: [0, 0, 0],
        rotationRate: [0, 0, 0],
      },
    });

    const output = browserSensorScoreV1.evaluate({
      schemaVersion: SCORE_INPUT_SCHEMA_VERSION,
      score: browserSensorScoreV1.metadata,
      frame: {
        frameIndex: 4,
        elapsedMs: 480,
        renderedAt: '2026-06-15T12:00:00.480Z',
      },
      streams: [stream],
      seed: 'world-instrument-test-still-sensor-v1',
    });

    expect(output.metadata).toMatchObject({
      condition: 'sensor-still',
      inputKind: 'browser-sensor',
    });
    expect(output.trace?.find((entry) => entry.key === 'condition')).toEqual({
      key: 'condition',
      value: 'sensor-still',
    });
    expect(output.haptic).toMatchObject({
      enabled: false,
    });
  });

  it('silences haptics for stale browser sensor streams', () => {
    const staleStream = {
      ...normalizeBrowserSensorPayload({
        provider: sensorFixture.provider,
        observedAt: sensorFixture.observedAt,
        device: sensorFixture.device,
        capabilities: {
          pointer: 'available',
          deviceMotion: 'available',
          deviceOrientation: 'available',
          permission: 'granted',
          fallback: 'none',
        },
        pointer: {
          position: [0.6, 0.4],
          velocity: [0.4, 0.1],
          pressure: 0.9,
          buttons: 1,
          active: true,
        },
        motion: {
          acceleration: [5, 0, 0],
          rotationRate: [0, 120, 0],
        },
      }),
      status: 'stale' as const,
    };

    const output = browserSensorScoreV1.evaluate({
      schemaVersion: SCORE_INPUT_SCHEMA_VERSION,
      score: browserSensorScoreV1.metadata,
      frame: {
        frameIndex: 5,
        elapsedMs: 600,
        renderedAt: '2026-06-15T12:00:03.600Z',
      },
      streams: [staleStream],
      seed: 'world-instrument-test-stale-sensor-v1',
    });

    expect(output.metadata).toMatchObject({
      condition: 'sensor-stale',
      inputKind: 'browser-sensor',
      streamStatus: 'stale',
    });
    expect(output.haptic).toMatchObject({
      enabled: false,
      parameters: [
        {
          key: 'pulseIntensity',
          value: 0,
        },
      ],
    });
  });

  it('replays browser sensor archives into the same deterministic score sequence', () => {
    const frame = browserSensorReplayFrame();
    const snapshot = parseReplaySnapshot({
      schemaVersion: REPLAY_SNAPSHOT_SCHEMA_VERSION,
      snapshotId: 'browser-sensor-score-v1-replay',
      createdAt: '2026-06-15T12:05:00.000Z',
      score: browserSensorScoreV1.metadata,
      frames: [frame],
      metadata: {
        fixture: true,
      },
    } satisfies ReplaySnapshot);
    const replayFrame = snapshot.frames[0];

    if (replayFrame === undefined) {
      throw new Error('Expected browser sensor replay frame.');
    }

    expect(
      browserSensorScoreV1.evaluate({
        schemaVersion: SCORE_INPUT_SCHEMA_VERSION,
        score: snapshot.score,
        frame: {
          frameIndex: replayFrame.frameIndex,
          elapsedMs: replayFrame.elapsedMs,
          renderedAt: replayFrame.capturedAt,
        },
        streams: replayFrame.streams,
        seed: replayFrame.seed,
      }),
    ).toEqual(replayFrame.output);
  });
});

function browserSensorReplayFrame(): ReplaySnapshot['frames'][number] {
  const stream = normalizeBrowserSensorPayload(sensorFixture, { sequence: 0 });
  const output = browserSensorScoreV1.evaluate({
    schemaVersion: SCORE_INPUT_SCHEMA_VERSION,
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
    frameIndex: 0,
    elapsedMs: 0,
    capturedAt: '2026-06-15T12:00:00.000Z',
    streams: [stream],
    output,
    seed: 'browser-sensor-score-v1:fixture:0',
  };
}

const sensorFixture: RecordedBrowserSensorPayload = createDeterministicBrowserSensorSnapshot({
  observedAt: '2026-06-15T12:00:00.000Z',
  receivedAt: '2026-06-15T12:00:01.000Z',
});
