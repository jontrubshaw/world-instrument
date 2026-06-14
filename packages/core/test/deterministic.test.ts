import { describe, expect, it } from 'vitest';

import {
  clamp,
  createSeededRandom,
  hashJson,
  hashString,
  lerp,
  normalize,
  randomRange,
  stableStringify,
} from '../src/index.js';

describe('deterministic utilities', () => {
  it('serializes JSON objects with stable key ordering', () => {
    const left = {
      z: [3, { b: true, a: null }],
      a: 'first',
    };
    const right = {
      a: 'first',
      z: [3, { a: null, b: true }],
    };

    expect(stableStringify(left)).toBe('{"a":"first","z":[3,{"a":null,"b":true}]}');
    expect(stableStringify(right)).toBe(stableStringify(left));
  });

  it('hashes equivalent JSON values to the same digest', () => {
    const left = { b: 2, a: 1 };
    const right = { a: 1, b: 2 };

    expect(hashJson(left)).toBe(hashJson(right));
    expect(hashJson(left)).toBe('5314055b');
    expect(hashString(stableStringify(left))).toBe(hashJson(left));
  });

  it('replays identical seeded random sequences', () => {
    const first = createSeededRandom('weather-pressure:frame:0');
    const second = createSeededRandom('weather-pressure:frame:0');
    const different = createSeededRandom('weather-pressure:frame:1');

    const firstSequence = [first(), first(), first()].map((value) => Number(value.toFixed(12)));
    const secondSequence = [second(), second(), second()].map((value) => Number(value.toFixed(12)));
    const differentSequence = [different(), different(), different()].map((value) =>
      Number(value.toFixed(12)),
    );

    expect(firstSequence).toEqual(secondSequence);
    expect(firstSequence).not.toEqual(differentSequence);
  });

  it('maps seeded random values into bounded ranges', () => {
    const random = createSeededRandom('bounded');
    const value = randomRange(random, -10, 10);

    expect(value).toBeGreaterThanOrEqual(-10);
    expect(value).toBeLessThanOrEqual(10);
  });

  it('provides bounded numeric primitives for scores', () => {
    expect(clamp(2, 0, 1)).toBe(1);
    expect(clamp(-1, 0, 1)).toBe(0);
    expect(lerp(10, 20, 0.25)).toBe(12.5);
    expect(normalize(15, 10, 20)).toBe(0.5);
  });

  it('rejects non-finite numbers that would break deterministic replay', () => {
    expect(() => stableStringify({ invalid: Number.NaN })).toThrow('finite number');
    expect(() => clamp(Number.POSITIVE_INFINITY, 0, 1)).toThrow('finite number');
    expect(() => randomRange(createSeededRandom('bad-range'), 1, 0)).toThrow('max must be greater');
  });
});
