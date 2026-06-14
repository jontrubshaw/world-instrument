import { describe, expect, it } from "vitest";

import {
  clamp,
  clampUnit,
  createDeterministicRandom,
  deterministicHash,
  lerp,
  seedToUnitInterval,
  stableStringify,
} from "../src/index.js";

describe("deterministic utilities", () => {
  it("serializes JSON with stable object key ordering", () => {
    expect(stableStringify({ b: 1, a: [true, null, "x"] })).toBe(
      '{"a":[true,null,"x"],"b":1}',
    );
    expect(stableStringify({ nested: { z: 1, a: 2 } })).toBe('{"nested":{"a":2,"z":1}}');
  });

  it("hashes structurally equal JSON to the same value", () => {
    expect(deterministicHash({ b: 1, a: 2 })).toBe(deterministicHash({ a: 2, b: 1 }));
    expect(seedToUnitInterval("weather")).toBeGreaterThanOrEqual(0);
    expect(seedToUnitInterval("weather")).toBeLessThan(1);
  });

  it("produces repeatable seeded random sequences", () => {
    const first = createDeterministicRandom("weather/frame-1");
    const second = createDeterministicRandom("weather/frame-1");

    const firstSequence = [first.nextFloat(), first.nextFloat(), first.nextInt(10, 20)];
    const secondSequence = [second.nextFloat(), second.nextFloat(), second.nextInt(10, 20)];

    expect(firstSequence).toEqual(secondSequence);
    expect(firstSequence[0]).toBeGreaterThanOrEqual(0);
    expect(firstSequence[0]).toBeLessThan(1);
    expect(firstSequence[2]).toBeGreaterThanOrEqual(10);
    expect(firstSequence[2]).toBeLessThan(20);
  });

  it("supports deterministic picks and forks", () => {
    const root = createDeterministicRandom({ score: "demo", frame: 12 });
    const sameRoot = createDeterministicRandom({ frame: 12, score: "demo" });

    expect(root.pick(["diffuse", "pulse", "glimmer"])).toBe(
      sameRoot.pick(["diffuse", "pulse", "glimmer"]),
    );
    expect(root.fork("visual").nextFloat()).toBe(sameRoot.fork("visual").nextFloat());
    expect(() => root.pick([])).toThrow(RangeError);
  });

  it("provides deterministic numeric helpers", () => {
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
    expect(clampUnit(1.5)).toBe(1);
    expect(lerp(10, 20, 0.25)).toBe(12.5);
  });
});
