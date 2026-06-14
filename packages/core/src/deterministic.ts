import type { JsonValue } from "./json.js";

const UINT32_SIZE = 0x100000000;
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export interface DeterministicRandom {
  nextFloat: () => number;
  nextInt: (minInclusive: number, maxExclusive: number) => number;
  pick: <T>(items: readonly T[]) => T;
  fork: (label: string) => DeterministicRandom;
}

export function stableStringify(value: JsonValue): string {
  if (value === null) {
    return "null";
  }

  if (typeof value === "string") {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) {
      throw new TypeError("Unable to encode string value.");
    }
    return encoded;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Deterministic JSON values must contain finite numbers.");
    }
    return JSON.stringify(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const objectValue = value as { readonly [key: string]: JsonValue };
  const entries = Object.keys(objectValue)
    .sort()
    .map((key) => {
      const child = objectValue[key];
      if (child === undefined) {
        throw new TypeError(`Deterministic JSON object contains undefined at "${key}".`);
      }
      return `${stableStringify(key)}:${stableStringify(child)}`;
    });

  return `{${entries.join(",")}}`;
}

export function fnv1a32(input: string): number {
  let hash = FNV_OFFSET_BASIS;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
  }

  return hash >>> 0;
}

export function normalizeSeed(seed: string | JsonValue): string {
  return typeof seed === "string" ? seed : stableStringify(seed);
}

export function deterministicHash(seed: string | JsonValue): string {
  return fnv1a32(normalizeSeed(seed)).toString(16).padStart(8, "0");
}

export function seedToUnitInterval(seed: string | JsonValue): number {
  return fnv1a32(normalizeSeed(seed)) / UINT32_SIZE;
}

export function createDeterministicRandom(seed: string | JsonValue): DeterministicRandom {
  const sourceSeed = normalizeSeed(seed);
  let state = fnv1a32(sourceSeed);

  const nextFloat = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / UINT32_SIZE;
  };

  return {
    nextFloat,
    nextInt(minInclusive, maxExclusive) {
      if (!Number.isInteger(minInclusive) || !Number.isInteger(maxExclusive)) {
        throw new TypeError("Deterministic integer bounds must be integers.");
      }
      if (maxExclusive <= minInclusive) {
        throw new RangeError("maxExclusive must be greater than minInclusive.");
      }

      return minInclusive + Math.floor(nextFloat() * (maxExclusive - minInclusive));
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) {
        throw new RangeError("Cannot pick from an empty collection.");
      }

      return items[this.nextInt(0, items.length)] as T;
    },
    fork(label) {
      return createDeterministicRandom(`${sourceSeed}/${label}`);
    },
  };
}

export function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    throw new RangeError("max must be greater than or equal to min.");
  }

  return Math.min(Math.max(value, min), max);
}

export function clampUnit(value: number): number {
  return clamp(value, 0, 1);
}

export function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}
