import type { JsonObject } from './json.ts';
import type { ScoreVersionMetadata } from './score.ts';
import type { StreamSample, StreamStateSchemaVersion } from './stream.ts';

export const STREAM_SOURCE_REGISTRY_SCHEMA_VERSION = 'stream-source-registry.v1' as const;

export type StreamSourceRegistrySchemaVersion = typeof STREAM_SOURCE_REGISTRY_SCHEMA_VERSION;
export type StreamSourceMode = 'fixture' | 'live' | 'replay';

export interface StreamSourceCapability {
  readonly mode: StreamSourceMode;
  readonly description: string;
  readonly requiresCredential?: boolean;
}

export interface StreamSourceAdapterMetadata {
  readonly id: string;
  readonly version: string;
  readonly packageName?: string;
  readonly description?: string;
}

export interface StreamSourceSampleDefinition {
  readonly key: string;
  readonly kind: StreamSample['kind'];
  readonly required: boolean;
  readonly unit?: string;
  readonly description: string;
}

export interface StreamSourceNormalizedMapping {
  readonly streamKind: string;
  readonly streamIdPrefix: string;
  readonly streamSchema: StreamStateSchemaVersion | string;
  readonly samples: readonly StreamSourceSampleDefinition[];
  readonly metadataKeys?: readonly string[];
  readonly description: string;
}

export interface StreamSourceScoreCompatibility {
  readonly scoreId: string;
  readonly scoreVersion?: string;
  readonly supportedStreamSchemas?: readonly string[];
  readonly description?: string;
}

export interface StreamSourceFixtureReference {
  readonly id: string;
  readonly description: string;
  readonly module?: string;
}

export interface StreamSourceDefinition {
  readonly schemaVersion: StreamSourceRegistrySchemaVersion;
  readonly id: string;
  readonly kind: string;
  readonly displayName: string;
  readonly description: string;
  readonly adapter: StreamSourceAdapterMetadata;
  readonly capabilities: readonly StreamSourceCapability[];
  readonly defaultMode: StreamSourceMode;
  readonly mapping: StreamSourceNormalizedMapping;
  readonly scoreCompatibility: readonly StreamSourceScoreCompatibility[];
  readonly defaultScoreId?: string;
  readonly fixtures?: readonly StreamSourceFixtureReference[];
  readonly metadata?: JsonObject;
}

export type ScoreCompatibilityCandidate = Pick<
  ScoreVersionMetadata,
  'scoreId' | 'scoreVersion' | 'supportedStreamSchemas'
>;

export class StreamSourceRegistry {
  readonly #definitions = new Map<string, StreamSourceDefinition>();

  constructor(definitions: readonly StreamSourceDefinition[] = []) {
    for (const definition of definitions) {
      this.register(definition);
    }
  }

  register(definition: StreamSourceDefinition): this {
    if (this.#definitions.has(definition.id)) {
      throw new Error(`Stream source '${definition.id}' is already registered.`);
    }

    this.#definitions.set(definition.id, definition);

    return this;
  }

  get(sourceId: string): StreamSourceDefinition | undefined {
    return this.#definitions.get(sourceId);
  }

  require(sourceId: string): StreamSourceDefinition {
    const definition = this.get(sourceId);

    if (definition === undefined) {
      throw new Error(`Stream source '${sourceId}' is not registered.`);
    }

    return definition;
  }

  list(): readonly StreamSourceDefinition[] {
    return Array.from(this.#definitions.values());
  }

  listByMode(mode: StreamSourceMode): readonly StreamSourceDefinition[] {
    return this.list().filter((definition) => supportsStreamSourceMode(definition, mode));
  }

  supports(sourceId: string, mode: StreamSourceMode): boolean {
    const definition = this.get(sourceId);

    return definition === undefined ? false : supportsStreamSourceMode(definition, mode);
  }

  compatibleSourcesForScore(score: ScoreCompatibilityCandidate): readonly StreamSourceDefinition[] {
    return this.list().filter((definition) => isStreamSourceCompatibleWithScore(definition, score));
  }

  compatibleScoresForSource(
    sourceId: string,
    scores: readonly ScoreCompatibilityCandidate[],
  ): readonly ScoreCompatibilityCandidate[] {
    const definition = this.require(sourceId);

    return scores.filter((score) => isStreamSourceCompatibleWithScore(definition, score));
  }
}

export function createStreamSourceRegistry(
  definitions: readonly StreamSourceDefinition[],
): StreamSourceRegistry {
  return new StreamSourceRegistry(definitions);
}

export function streamSourceModes(definition: StreamSourceDefinition): readonly StreamSourceMode[] {
  return definition.capabilities.map((capability) => capability.mode);
}

export function supportsStreamSourceMode(
  definition: StreamSourceDefinition,
  mode: StreamSourceMode,
): boolean {
  return definition.capabilities.some((capability) => capability.mode === mode);
}

export function isStreamSourceCompatibleWithScore(
  definition: StreamSourceDefinition,
  score: ScoreCompatibilityCandidate,
): boolean {
  return definition.scoreCompatibility.some(
    (compatibility) =>
      compatibility.scoreId === score.scoreId &&
      scoreVersionMatches(compatibility, score) &&
      schemaMatches(definition, compatibility, score),
  );
}

function scoreVersionMatches(
  compatibility: StreamSourceScoreCompatibility,
  score: ScoreCompatibilityCandidate,
): boolean {
  return (
    compatibility.scoreVersion === undefined || compatibility.scoreVersion === score.scoreVersion
  );
}

function schemaMatches(
  definition: StreamSourceDefinition,
  compatibility: StreamSourceScoreCompatibility,
  score: ScoreCompatibilityCandidate,
): boolean {
  const compatibleSchemas = compatibility.supportedStreamSchemas ?? [
    definition.mapping.streamSchema,
  ];

  return compatibleSchemas.some((schema) => score.supportedStreamSchemas.includes(schema));
}
