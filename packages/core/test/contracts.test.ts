import { describe, expect, it } from "vitest";

import {
  clampUnit,
  deterministicHash,
  type NormalizedStreamState,
  type Score,
  type ScoreInput,
  type ScoreOutput,
  type ScoreVersionMetadata,
  type StreamAdapter,
} from "../src/index.js";

interface DemoWeatherPayload {
  readonly tempC: number;
  readonly condition: string;
}

const scoreVersion: ScoreVersionMetadata = {
  scoreId: "weather-pressure",
  version: "0.1.0",
  deterministicHash: deterministicHash("weather-pressure@0.1.0"),
  createdAt: "2026-06-14T16:40:00.000Z",
};

const weatherAdapter: StreamAdapter<DemoWeatherPayload> = {
  metadata: {
    adapterId: "weather.adapter.demo",
    displayName: "Demo weather adapter",
    version: "0.1.0",
    supportedKinds: ["scalar", "category"],
  },
  normalize(envelope): NormalizedStreamState {
    return {
      schemaVersion: "world-instrument.normalized-stream-state.v1",
      streamId: envelope.streamId,
      adapterId: "weather.adapter.demo",
      status: "active",
      observedAt: envelope.capturedAt,
      sequence: envelope.sequence ?? 0,
      channels: [
        {
          kind: "scalar",
          key: "temperature",
          value: envelope.payload.tempC,
          unit: "celsius",
          confidence: 1,
        },
        {
          kind: "category",
          key: "condition",
          value: envelope.payload.condition,
        },
      ],
    };
  },
};

const weatherScore: Score = {
  metadata: scoreVersion,
  evaluate(input): ScoreOutput {
    const weather = input.streams.find((stream) => stream.streamId === "weather.london");
    const temperature = weather?.channels.find(
      (channel) => channel.kind === "scalar" && channel.key === "temperature",
    );
    const value = temperature?.kind === "scalar" ? temperature.value : 0;

    return {
      schemaVersion: "world-instrument.score-output.v1",
      scoreId: input.scoreId,
      scoreVersion: input.scoreVersion,
      frame: input.frame,
      channels: [
        {
          kind: "visual",
          key: "diffusion",
          value: clampUnit(value / 40),
        },
      ],
    };
  },
};

describe("public contracts", () => {
  it("lets adapters normalize raw stream envelopes", async () => {
    const state = await weatherAdapter.normalize(
      {
        streamId: "weather.london",
        capturedAt: "2026-06-14T16:47:00.000Z",
        sequence: 7,
        payload: {
          tempC: 20,
          condition: "cloudy",
        },
      },
      {
        now: () => "2026-06-14T16:47:00.000Z",
      },
    );

    expect(state.streamId).toBe("weather.london");
    expect(state.sequence).toBe(7);
    expect(state.channels).toHaveLength(2);
  });

  it("lets scores deterministically evaluate normalized stream state", async () => {
    const streamState = await weatherAdapter.normalize(
      {
        streamId: "weather.london",
        capturedAt: "2026-06-14T16:47:00.000Z",
        payload: {
          tempC: 20,
          condition: "cloudy",
        },
      },
      {
        now: () => "2026-06-14T16:47:00.000Z",
      },
    );

    const input: ScoreInput = {
      schemaVersion: "world-instrument.score-input.v1",
      scoreId: "weather-pressure",
      scoreVersion,
      frame: {
        frameId: "frame-000001",
        frameIndex: 1,
        time: "2026-06-14T16:47:00.000Z",
        deltaMs: 16.667,
      },
      streams: [streamState],
      seed: "weather-pressure/frame-000001",
    };

    const first = weatherScore.evaluate(input, {
      now: () => "2026-06-14T16:47:00.000Z",
    });
    const second = weatherScore.evaluate(input, {
      now: () => "2026-06-14T16:47:00.000Z",
    });

    expect(first).toEqual(second);
    expect(first.channels[0]).toMatchObject({
      kind: "visual",
      key: "diffusion",
      value: 0.5,
    });
  });
});
