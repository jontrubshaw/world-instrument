import { describe, expect, it } from 'vitest';

import {
  SCORE_INPUT_SCHEMA_VERSION,
  SCORE_OUTPUT_SCHEMA_VERSION,
  SCORE_VERSION_SCHEMA_VERSION,
  STREAM_STATE_SCHEMA_VERSION,
  clamp,
  hashJson,
  normalize,
  type NormalizedStreamState,
  type Score,
  type ScoreInput,
  type ScoreOutput,
  type ScoreVersionMetadata,
  type StreamAdapter,
  type StreamAdapterResult,
} from '../src/index.js';

const observedAt = '2026-06-14T20:00:00.000Z';

const weatherState: NormalizedStreamState = {
  schemaVersion: STREAM_STATE_SCHEMA_VERSION,
  streamId: 'weather:london',
  source: {
    id: 'open-meteo:london',
    kind: 'weather',
    label: 'London weather',
  },
  status: 'ok',
  observedAt,
  receivedAt: '2026-06-14T20:00:01.000Z',
  sequence: 42,
  samples: [
    {
      kind: 'numeric',
      key: 'temperature',
      label: 'Temperature',
      observedAt,
      quality: 'measured',
      value: 18.4,
      unit: 'celsius',
    },
    {
      kind: 'categorical',
      key: 'condition',
      observedAt,
      quality: 'measured',
      value: 'cloudy',
      confidence: 0.83,
    },
  ],
  metadata: {
    provider: 'fixture',
  },
};

const scoreMetadata: ScoreVersionMetadata = {
  schemaVersion: SCORE_VERSION_SCHEMA_VERSION,
  scoreId: 'weather-pressure',
  scoreVersion: '1.0.0',
  displayName: 'Weather Pressure',
  deterministic: true,
  supportedStreamSchemas: [STREAM_STATE_SCHEMA_VERSION],
};

class FixtureWeatherAdapter implements StreamAdapter<{ readonly temperature: number }> {
  readonly id = 'fixture-weather';
  readonly version = '1.0.0';
  readonly source = weatherState.source;

  read(): Promise<StreamAdapterResult<{ readonly temperature: number }>> {
    return Promise.resolve({
      raw: {
        temperature: 18.4,
      },
      state: weatherState,
    });
  }
}

class FixtureWeatherScore implements Score {
  readonly metadata = scoreMetadata;

  evaluate(input: ScoreInput): ScoreOutput {
    const temperatureSample = input.streams[0]?.samples.find(
      (sample) => sample.kind === 'numeric' && sample.key === 'temperature',
    );
    const temperature = temperatureSample?.kind === 'numeric' ? temperatureSample.value : 0;
    const diffusion = normalize(temperature, -10, 40);

    return {
      schemaVersion: SCORE_OUTPUT_SCHEMA_VERSION,
      scoreId: this.metadata.scoreId,
      scoreVersion: this.metadata.scoreVersion,
      frameIndex: input.frame.frameIndex,
      generatedAt: input.frame.renderedAt ?? input.streams[0]?.observedAt ?? observedAt,
      visual: {
        parameters: [
          {
            key: 'diffusion',
            value: clamp(diffusion, 0, 1),
            min: 0,
            max: 1,
          },
        ],
      },
      trace: [
        {
          key: 'inputHash',
          value: hashJson({
            seed: input.seed,
            streamId: input.streams[0]?.streamId ?? 'missing',
            sequence: input.streams[0]?.sequence ?? -1,
          }),
        },
      ],
    };
  }
}

describe('core stream and score contracts', () => {
  it('allows adapters to return raw input with normalized stream state', async () => {
    const adapter = new FixtureWeatherAdapter();
    const result = await adapter.read();

    expect(result.raw.temperature).toBe(18.4);
    expect(result.state.schemaVersion).toBe(STREAM_STATE_SCHEMA_VERSION);
    expect(result.state.samples).toHaveLength(2);
  });

  it('allows scores to deterministically evaluate normalized state', () => {
    const score = new FixtureWeatherScore();
    const input: ScoreInput = {
      schemaVersion: SCORE_INPUT_SCHEMA_VERSION,
      score: score.metadata,
      frame: {
        frameIndex: 0,
        elapsedMs: 0,
        renderedAt: observedAt,
      },
      streams: [weatherState],
      seed: 'weather-pressure:0',
    };

    const first = score.evaluate(input);
    const second = score.evaluate(input);

    expect(first).toEqual(second);
    expect(first.visual.parameters[0]).toEqual({
      key: 'diffusion',
      value: 0.568,
      min: 0,
      max: 1,
    });
    expect(first.trace?.[0]?.value).toBe(second.trace?.[0]?.value);
  });
});
