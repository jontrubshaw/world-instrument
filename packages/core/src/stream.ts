import type { JsonObject } from './json.ts';

export const STREAM_STATE_SCHEMA_VERSION = 'stream-state.v1' as const;

export type StreamStateSchemaVersion = typeof STREAM_STATE_SCHEMA_VERSION;

export type StreamStatus = 'degraded' | 'error' | 'ok' | 'stale';

export type StreamSampleQuality = 'estimated' | 'measured' | 'missing';

export interface StreamSource {
  readonly id: string;
  readonly kind: string;
  readonly label?: string;
  readonly uri?: string;
}

export interface StreamSampleBase {
  readonly key: string;
  readonly label?: string;
  readonly observedAt: string;
  readonly quality: StreamSampleQuality;
}

export interface NumericStreamSample extends StreamSampleBase {
  readonly kind: 'numeric';
  readonly value: number;
  readonly unit?: string;
  readonly delta?: number;
  readonly rollingAverage?: number;
}

export interface CategoricalStreamSample extends StreamSampleBase {
  readonly kind: 'categorical';
  readonly value: string;
  readonly confidence?: number;
}

export interface BooleanStreamSample extends StreamSampleBase {
  readonly kind: 'boolean';
  readonly value: boolean;
  readonly confidence?: number;
}

export interface VectorStreamSample extends StreamSampleBase {
  readonly kind: 'vector';
  readonly values: readonly number[];
  readonly axes?: readonly string[];
  readonly unit?: string;
}

export type StreamSample =
  | BooleanStreamSample
  | CategoricalStreamSample
  | NumericStreamSample
  | VectorStreamSample;

export interface NormalizedStreamState {
  readonly schemaVersion: StreamStateSchemaVersion;
  readonly streamId: string;
  readonly source: StreamSource;
  readonly status: StreamStatus;
  readonly observedAt: string;
  readonly receivedAt: string;
  readonly sequence: number;
  readonly samples: readonly StreamSample[];
  readonly metadata?: JsonObject;
}

export interface StreamReadRequest {
  readonly afterSequence?: number;
  readonly signal?: AbortSignal;
}

export interface StreamAdapterResult<TRaw = unknown> {
  readonly raw: TRaw;
  readonly state: NormalizedStreamState;
}

export interface StreamAdapter<TRaw = unknown, TConfig = unknown> {
  readonly id: string;
  readonly version: string;
  readonly source: StreamSource;
  configure?(config: TConfig): Promise<void> | void;
  read(request?: StreamReadRequest): Promise<StreamAdapterResult<TRaw>>;
}
