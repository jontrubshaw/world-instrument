import { describe, expect, it } from 'vitest';

import {
  SCORE_VERSION_SCHEMA_VERSION,
  STREAM_SOURCE_REGISTRY_SCHEMA_VERSION,
  STREAM_STATE_SCHEMA_VERSION,
  StreamSourceRegistry,
  createStreamSourceRegistry,
  isStreamSourceCompatibleWithScore,
  streamSourceModes,
  supportsStreamSourceMode,
  type ScoreVersionMetadata,
  type StreamSourceDefinition,
} from '../src/index.ts';

describe('stream source registry contracts', () => {
  it('lists and resolves registered stream sources by id and mode', () => {
    const registry = createStreamSourceRegistry([testWeatherSourceDefinition]);

    expect(registry.list()).toEqual([testWeatherSourceDefinition]);
    expect(registry.get('weather.test')).toBe(testWeatherSourceDefinition);
    expect(registry.require('weather.test')).toBe(testWeatherSourceDefinition);
    expect(registry.listByMode('live')).toEqual([testWeatherSourceDefinition]);
    expect(registry.listByMode('replay')).toEqual([]);
    expect(registry.supports('weather.test', 'fixture')).toBe(true);
    expect(registry.supports('weather.test', 'replay')).toBe(false);
    expect(registry.supports('missing', 'fixture')).toBe(false);
    expect(streamSourceModes(testWeatherSourceDefinition)).toEqual(['fixture', 'live']);
  });

  it('rejects duplicate ids and missing required lookups', () => {
    expect(
      () => new StreamSourceRegistry([testWeatherSourceDefinition, testWeatherSourceDefinition]),
    ).toThrow("Stream source 'weather.test' is already registered.");

    expect(() => new StreamSourceRegistry().require('weather.test')).toThrow(
      "Stream source 'weather.test' is not registered.",
    );
  });

  it('checks score compatibility using id, version, and stream schema', () => {
    const registry = createStreamSourceRegistry([testWeatherSourceDefinition]);

    expect(isStreamSourceCompatibleWithScore(testWeatherSourceDefinition, compatibleScore)).toBe(
      true,
    );
    expect(registry.compatibleSourcesForScore(compatibleScore)).toEqual([
      testWeatherSourceDefinition,
    ]);
    expect(
      registry.compatibleScoresForSource('weather.test', [compatibleScore, wrongScore]),
    ).toEqual([compatibleScore]);
    expect(isStreamSourceCompatibleWithScore(testWeatherSourceDefinition, wrongScore)).toBe(false);
    expect(isStreamSourceCompatibleWithScore(testWeatherSourceDefinition, wrongSchema)).toBe(false);
  });
});

const testWeatherSourceDefinition: StreamSourceDefinition = {
  schemaVersion: STREAM_SOURCE_REGISTRY_SCHEMA_VERSION,
  id: 'weather.test',
  kind: 'weather',
  displayName: 'Test weather',
  description: 'Fixture and live weather source for registry tests.',
  adapter: {
    id: 'weather.test',
    version: '1.0.0',
  },
  capabilities: [
    {
      mode: 'fixture',
      description: 'Reads recorded payloads.',
    },
    {
      mode: 'live',
      description: 'Reads a live endpoint.',
      requiresCredential: false,
    },
  ],
  defaultMode: 'fixture',
  mapping: {
    streamKind: 'weather',
    streamIdPrefix: 'weather',
    streamSchema: STREAM_STATE_SCHEMA_VERSION,
    samples: [
      {
        key: 'temperature',
        kind: 'numeric',
        required: true,
        unit: 'celsius',
        description: 'Air temperature.',
      },
    ],
    description: 'Weather samples are normalized as scalar environmental measurements.',
  },
  scoreCompatibility: [
    {
      scoreId: 'weather-score',
      scoreVersion: '1.0.0',
      supportedStreamSchemas: [STREAM_STATE_SCHEMA_VERSION],
    },
  ],
  defaultScoreId: 'weather-score',
};

const compatibleScore: ScoreVersionMetadata = {
  schemaVersion: SCORE_VERSION_SCHEMA_VERSION,
  scoreId: 'weather-score',
  scoreVersion: '1.0.0',
  displayName: 'Weather Score v1',
  deterministic: true,
  supportedStreamSchemas: [STREAM_STATE_SCHEMA_VERSION],
};

const wrongScore: ScoreVersionMetadata = {
  ...compatibleScore,
  scoreId: 'news-score',
};

const wrongSchema: ScoreVersionMetadata = {
  ...compatibleScore,
  supportedStreamSchemas: ['stream-state.v2'],
};
