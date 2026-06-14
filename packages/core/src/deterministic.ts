import type { JsonObject, JsonValue } from './json.js';

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const UINT32_SIZE = 0x1_0000_0000;
const MULBERRY_INCREMENT = 0x6d2b79f5;

export type SeededRandom = () => number;

export function stableStringify(value: JsonValue): string {
  if (value === null) {
    return 'null';
  }

  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      assertFiniteNumber(value, 'JSON number');
      return JSON.stringify(value);
    case 'string':
      return stringifyString(value);
    case 'object':
      if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(',')}]`;
      }

      return stableStringifyObject(value);
  }
}

export function hashString(input: string): string {
  return fnv1a32(input).toString(16).padStart(8, '0');
}

export function hashJson(value: JsonValue): string {
  return hashString(stableStringify(value));
}

export function createSeededRandom(seed: string): SeededRandom {
  let state = fnv1a32(seed);

  if (state === 0) {
    state = MULBERRY_INCREMENT;
  }

  return () => {
    state = (state + MULBERRY_INCREMENT) >>> 0;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / UINT32_SIZE;
  };
}

export function randomRange(random: SeededRandom, min: number, max: number): number {
  assertFiniteNumber(min, 'min');
  assertFiniteNumber(max, 'max');

  if (max < min) {
    throw new RangeError('max must be greater than or equal to min');
  }

  return min + random() * (max - min);
}

export function clamp(value: number, min: number, max: number): number {
  assertFiniteNumber(value, 'value');
  assertFiniteNumber(min, 'min');
  assertFiniteNumber(max, 'max');

  if (max < min) {
    throw new RangeError('max must be greater than or equal to min');
  }

  return Math.min(Math.max(value, min), max);
}

export function lerp(start: number, end: number, amount: number): number {
  assertFiniteNumber(start, 'start');
  assertFiniteNumber(end, 'end');
  assertFiniteNumber(amount, 'amount');

  return start + (end - start) * amount;
}

export function normalize(value: number, min: number, max: number): number {
  assertFiniteNumber(value, 'value');
  assertFiniteNumber(min, 'min');
  assertFiniteNumber(max, 'max');

  if (max === min) {
    throw new RangeError('max must be different from min');
  }

  return clamp((value - min) / (max - min), 0, 1);
}

function stableStringifyObject(value: JsonObject): string {
  const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
  const serialized = entries.map(([key, item]) => `${stringifyString(key)}:${stableStringify(item)}`);

  return `{${serialized.join(',')}}`;
}

function stringifyString(value: string): string {
  const serialized = JSON.stringify(value);

  if (serialized === undefined) {
    throw new TypeError('Unable to serialize string');
  }

  return serialized;
}

function fnv1a32(input: string): number {
  let hash = FNV_OFFSET_BASIS;

  for (const byte of new TextEncoder().encode(input)) {
    hash ^= byte;
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }

  return hash >>> 0;
}

function assertFiniteNumber(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be a finite number`);
  }
}
