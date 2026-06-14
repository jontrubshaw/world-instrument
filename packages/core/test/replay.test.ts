import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  isReplaySnapshot,
  parseReplaySnapshot,
  REPLAY_SNAPSHOT_SCHEMA_VERSION,
  replaySnapshotJsonSchema,
} from "../src/index.js";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function readFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(fixturesDir, name), "utf8")) as unknown;
}

describe("replay snapshot schema", () => {
  it("documents the current replay snapshot schema version", () => {
    expect(replaySnapshotJsonSchema.properties.schemaVersion.const).toBe(
      REPLAY_SNAPSHOT_SCHEMA_VERSION,
    );
  });

  it("accepts all valid replay snapshot fixtures", () => {
    const validFixtures = readdirSync(fixturesDir).filter((fileName) =>
      fileName.endsWith(".valid.json"),
    );

    expect(validFixtures).toContain("replay-snapshot.v1.valid.json");

    for (const fixtureName of validFixtures) {
      const value = readFixture(fixtureName);
      expect(isReplaySnapshot(value), fixtureName).toBe(true);
      expect(parseReplaySnapshot(value).schemaVersion).toBe(REPLAY_SNAPSHOT_SCHEMA_VERSION);
    }
  });

  it("rejects invalid replay snapshot fixtures", () => {
    const invalidFixture = readFixture("replay-snapshot.v1.invalid.json");

    expect(isReplaySnapshot(invalidFixture)).toBe(false);
    expect(() => parseReplaySnapshot(invalidFixture)).toThrow(TypeError);
  });
});
