import { describe, expect, it } from 'vitest';

import {
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
        inputKind: 'sensor',
      },
    });
  });

  it('maps deterministic browser sensor fixtures through the sensor score', () => {
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
        inputKind: 'sensor',
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

  it('adapts live pointer fallback snapshots without weather score metadata', () => {
    const stream = normalizeBrowserSensorPayload(
      {
        provider: sensorFixture.provider,
        observedAt: sensorFixture.observedAt,
        device: sensorFixture.device,
        capabilities: {
          pointer: 'available',
          deviceMotion: 'permission-required',
          deviceOrientation: 'unavailable',
          permission: 'not-requested',
          fallback: 'pointer',
        },
        pointer: {
          position: [0.25, 0.75],
          velocity: [0.04, 0.01],
          pressure: 0.6,
          buttons: 1,
          active: true,
        },
      },
      {
        mode: 'live',
        now: '2026-06-15T12:00:00.500Z',
        sequence: 6,
        staleAfterMs: 2_000,
      },
    );

    const output = browserSensorScoreV1.evaluate({
      schemaVersion: SCORE_INPUT_SCHEMA_VERSION,
      score: browserSensorScoreV1.metadata,
      frame: {
        frameIndex: 6,
        elapsedMs: 600,
        renderedAt: '2026-06-15T12:00:00.600Z',
      },
      streams: [stream],
      seed: 'world-instrument-test-live-sensor-v1',
    });

    expect(output).toMatchObject({
      scoreId: 'browser-sensor-score',
      scoreVersion: '1.0.0',
      metadata: {
        condition: 'sensor-touch',
        inputKind: 'sensor',
        streamStatus: 'degraded',
      },
      haptic: {
        enabled: true,
      },
    });
    expect(output.scoreId).not.toBe('weather-score');
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
        frameIndex: 3,
        elapsedMs: 360,
        renderedAt: '2026-06-15T12:00:00.360Z',
      },
      streams: [stream],
      seed: 'world-instrument-test-still-sensor-v1',
    });

    expect(output.metadata).toMatchObject({
      condition: 'sensor-still',
      inputKind: 'sensor',
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
        frameIndex: 4,
        elapsedMs: 480,
        renderedAt: '2026-06-15T12:00:03.480Z',
      },
      streams: [staleStream],
      seed: 'world-instrument-test-stale-sensor-v1',
    });

    expect(output.metadata).toMatchObject({
      condition: 'sensor-stale',
      inputKind: 'sensor',
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

  it('replays browser sensor frames through the same score output', () => {
    const stream = normalizeBrowserSensorPayload(sensorFixture, { sequence: 8 });
    const output = browserSensorScoreV1.evaluate({
      schemaVersion: SCORE_INPUT_SCHEMA_VERSION,
      score: browserSensorScoreV1.metadata,
      frame: {
        frameIndex: 8,
        elapsedMs: 800,
        renderedAt: '2026-06-15T12:00:00.800Z',
      },
      streams: [stream],
      seed: 'world-instrument-test-sensor-replay-v1',
    });
    const snapshot = parseReplaySnapshot({
      schemaVersion: 'replay-snapshot.v1',
      snapshotId: 'browser-sensor-score-v1-test',
      createdAt: '2026-06-15T12:00:01.000Z',
      score: browserSensorScoreV1.metadata,
      frames: [
        {
          frameIndex: 8,
          elapsedMs: 800,
          capturedAt: '2026-06-15T12:00:00.800Z',
          seed: 'world-instrument-test-sensor-replay-v1',
          streams: [stream],
          output,
        },
      ],
    } satisfies ReplaySnapshot);
    const replayFrame = snapshot.frames[0];

    if (replayFrame === undefined) {
      throw new Error('Expected browser sensor replay fixture frame.');
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
    ).toEqual(output);
  });
});

const sensorFixture: RecordedBrowserSensorPayload = createDeterministicBrowserSensorSnapshot({
  observedAt: '2026-06-15T12:00:00.000Z',
});
