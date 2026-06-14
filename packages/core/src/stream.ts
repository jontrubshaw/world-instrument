import type { JsonObject, JsonValue } from "./json.js";

export type StreamId = string;
export type StreamAdapterId = string;
export type IsoTimestamp = string;

export type StreamStateStatus = "active" | "stale" | "error" | "ended";

export interface BaseStreamChannel {
  readonly key: string;
  readonly label?: string;
  readonly confidence?: number;
  readonly observedAt?: IsoTimestamp;
  readonly metadata?: JsonObject;
}

export interface ScalarStreamChannel extends BaseStreamChannel {
  readonly kind: "scalar";
  readonly value: number;
  readonly unit?: string;
}

export interface RateStreamChannel extends BaseStreamChannel {
  readonly kind: "rate";
  readonly value: number;
  readonly per: "second" | "minute" | "hour" | "day";
  readonly unit?: string;
}

export interface CategoryStreamChannel extends BaseStreamChannel {
  readonly kind: "category";
  readonly value: string;
  readonly vocabulary?: readonly string[];
}

export interface FlagStreamChannel extends BaseStreamChannel {
  readonly kind: "flag";
  readonly value: boolean;
}

export interface EventStreamChannel extends BaseStreamChannel {
  readonly kind: "event";
  readonly value: string;
  readonly weight?: number;
}

export type NormalizedStreamChannel =
  | ScalarStreamChannel
  | RateStreamChannel
  | CategoryStreamChannel
  | FlagStreamChannel
  | EventStreamChannel;

export interface StreamIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: "info" | "warning" | "error";
  readonly metadata?: JsonObject;
}

export interface NormalizedStreamState {
  readonly schemaVersion: "world-instrument.normalized-stream-state.v1";
  readonly streamId: StreamId;
  readonly adapterId: StreamAdapterId;
  readonly sourceId?: string;
  readonly status: StreamStateStatus;
  readonly observedAt: IsoTimestamp;
  readonly receivedAt?: IsoTimestamp;
  readonly sequence: number;
  readonly channels: readonly NormalizedStreamChannel[];
  readonly issues?: readonly StreamIssue[];
  readonly metadata?: JsonObject;
}

export interface StreamAdapterMetadata {
  readonly adapterId: StreamAdapterId;
  readonly displayName: string;
  readonly version: string;
  readonly supportedKinds: readonly NormalizedStreamChannel["kind"][];
}

export interface RawStreamEnvelope<TRaw = JsonValue> {
  readonly streamId: StreamId;
  readonly capturedAt: IsoTimestamp;
  readonly payload: TRaw;
  readonly sequence?: number;
  readonly metadata?: JsonObject;
}

export interface StreamAdapterContext {
  readonly signal?: AbortSignal;
  readonly now: () => IsoTimestamp;
}

export type MaybePromise<T> = T | Promise<T>;

export interface StreamAdapter<
  TRaw = JsonValue,
  TConfig extends JsonObject = JsonObject,
  TState extends NormalizedStreamState = NormalizedStreamState,
> {
  readonly metadata: StreamAdapterMetadata;
  configure?: (config: TConfig, context: StreamAdapterContext) => MaybePromise<void>;
  read?: (context: StreamAdapterContext) => AsyncIterable<RawStreamEnvelope<TRaw>>;
  normalize: (
    envelope: RawStreamEnvelope<TRaw>,
    context: StreamAdapterContext,
  ) => MaybePromise<TState>;
}
