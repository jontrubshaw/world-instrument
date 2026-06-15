import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
  SCORE_INPUT_SCHEMA_VERSION,
  parseReplaySnapshot,
  type ReplaySnapshot,
} from '@world-instrument/core';
import {
  normalizeWeatherPayload,
  type RecordedWeatherPayload,
} from '@world-instrument/adapters';

import {
  WEATHER_SCORE_V1_ID,
  WEATHER_SCORE_V1_METADATA,
  WEATHER_SCORE_V1_VERSION,
  weatherScoreV1,
} from '../src/index.ts';

describe('weather score v1', () => {
  it('publishes explicit deterministic score metadata', () => {
    expect(WEATHER_SCORE_V1_METADATA).toMatchObject({
      scoreId: WEATHER_SCORE_V1_ID,
      scoreVersion: WEATHER_SCORE_V1_VERSION,
      displayName: 'Weather Score v1',
      deterministic: true,
      supportedStreamSchemas: ['stream-state.v1'],
    });
  });

  it('matches the recorded golden replay output', async () => {
    const snapshot = await loadReplaySnapshot();
    const frame = firstFrame(snapshot);
    const expectedOutput = frame.output;

    if (expectedOutput === undefined) {
      throw new Error('weather score replay fixture must include golden output');
    }

    const output = weatherScoreV1.evaluate({
      schemaVersion: SCORE_INPUT_SCHEMA_VERSION,
      score: weatherScoreV1.metadata,
      frame: {
        frameIndex: frame.frameIndex,
        elapsedMs: frame.elapsedMs,
        renderedAt: frame.capturedAt,
      },
      streams: frame.streams,
      seed: frame.seed,
    });

    expect(output).toEqual(expectedOutput);
  });

  it('is deterministic for identical fixture input', async () => {
    const snapshot = await loadReplaySnapshot();
    const frame = firstFrame(snapshot);
    const input = {
      schemaVersion: SCORE_INPUT_SCHEMA_VERSION,
      score: weatherScoreV1.metadata,
      frame: {
        frameIndex: frame.frameIndex,
        elapsedMs: frame.elapsedMs,
        renderedAt: frame.capturedAt,
      },
      streams: frame.streams,
      seed: frame.seed,
    };

    const first = weatherScoreV1.evaluate(input);
    const second = weatherScoreV1.evaluate(input);

    expect(first).toEqual(second);
  });

  it('keeps the adapter fixture aligned with the replay stream fixture', async () => {
    const weatherFixture = await loadWeatherFixture();
    const snapshot = await loadReplaySnapshot();
    const frame = firstFrame(snapshot);

    expect(normalizeWeatherPayload(weatherFixture)).toEqual(frame.streams[0]);
  });
});

function firstFrame(snapshot: ReplaySnapshot): ReplaySnapshot['frames'][number] {
  const frame = snapshot.frames[0];

  if (frame === undefined) {
    throw new Error('weather score replay fixture must include at least one frame');
  }

  return frame;
}

async function loadReplaySnapshot(): Promise<ReplaySnapshot> {
  const contents = await readFile(
    new URL('./fixtures/weather-score-v1.replay.json', import.meta.url),
    'utf8',
  );

  return parseReplaySnapshot(JSON.parse(contents) as unknown);
}

async function loadWeatherFixture(): Promise<RecordedWeatherPayload> {
  const contents = await readFile(
    new URL('../../adapters/test/fixtures/open-meteo-london-current.v1.json', import.meta.url),
    'utf8',
  );

  return JSON.parse(contents) as RecordedWeatherPayload;
}

