import {
  STREAM_SOURCE_REGISTRY_SCHEMA_VERSION,
  STREAM_STATE_SCHEMA_VERSION,
  createStreamSourceRegistry,
  type StreamAdapter,
  type StreamSourceDefinition,
} from '@world-instrument/core';

import {
  MOCK_SENSOR_ADAPTER_ID,
  MOCK_SENSOR_ADAPTER_VERSION,
  MockSensorAdapter,
  type MockSensorAdapterConfig,
} from './mock-sensor.ts';
import {
  WEATHER_ADAPTER_ID,
  WEATHER_ADAPTER_VERSION,
  WeatherAdapter,
  type WeatherAdapterConfig,
} from './weather.ts';

export const WEATHER_STREAM_SOURCE_ID = WEATHER_ADAPTER_ID;
export const MOCK_SENSOR_STREAM_SOURCE_ID = MOCK_SENSOR_ADAPTER_ID;

const WEATHER_SCORE_ID = 'weather-score';
const WEATHER_SCORE_VERSION = '1.0.0';

export const weatherStreamSourceDefinition = {
  schemaVersion: STREAM_SOURCE_REGISTRY_SCHEMA_VERSION,
  id: WEATHER_STREAM_SOURCE_ID,
  kind: 'weather',
  displayName: 'Open-Meteo weather',
  description: 'Credential-free Open-Meteo weather frames normalized into weather stream samples.',
  adapter: {
    id: WEATHER_ADAPTER_ID,
    version: WEATHER_ADAPTER_VERSION,
    packageName: '@world-instrument/adapters',
    description: 'Reads recorded or live Open-Meteo current weather payloads.',
  },
  capabilities: [
    {
      mode: 'fixture',
      description: 'Reads recorded Open-Meteo-shaped payloads from package fixtures.',
    },
    {
      mode: 'live',
      description: 'Reads Open-Meteo current weather without requiring credentials.',
      requiresCredential: false,
    },
    {
      mode: 'replay',
      description: 'Replays archived normalized weather stream frames.',
    },
  ],
  defaultMode: 'fixture',
  mapping: {
    streamKind: 'weather',
    streamIdPrefix: 'weather',
    streamSchema: STREAM_STATE_SCHEMA_VERSION,
    description:
      'Weather payloads map into scalar environmental measurements plus condition, rain, and wind vector samples.',
    metadataKeys: ['provider', 'mode', 'condition', 'weatherCode', 'location'],
    samples: [
      {
        key: 'temperature',
        kind: 'numeric',
        required: true,
        unit: 'celsius',
        description: 'Air temperature.',
      },
      {
        key: 'apparentTemperature',
        kind: 'numeric',
        required: false,
        unit: 'celsius',
        description: 'Perceived air temperature.',
      },
      {
        key: 'relativeHumidity',
        kind: 'numeric',
        required: true,
        unit: 'percent',
        description: 'Relative humidity.',
      },
      {
        key: 'precipitation',
        kind: 'numeric',
        required: false,
        unit: 'mm',
        description: 'Total precipitation for the current observation.',
      },
      {
        key: 'rain',
        kind: 'numeric',
        required: false,
        unit: 'mm',
        description: 'Rainfall for the current observation.',
      },
      {
        key: 'pressure',
        kind: 'numeric',
        required: false,
        unit: 'hPa',
        description: 'Surface pressure.',
      },
      {
        key: 'cloudCover',
        kind: 'numeric',
        required: false,
        unit: 'percent',
        description: 'Cloud cover.',
      },
      {
        key: 'windSpeed',
        kind: 'numeric',
        required: true,
        unit: 'm/s',
        description: 'Wind speed.',
      },
      {
        key: 'condition',
        kind: 'categorical',
        required: true,
        description: 'Weather condition derived from provider weather codes.',
      },
      {
        key: 'isRaining',
        kind: 'boolean',
        required: false,
        description: 'True when precipitation or rain is measured above zero.',
      },
      {
        key: 'windVector',
        kind: 'vector',
        required: false,
        unit: 'normalized',
        description: 'Two-axis normalized wind vector ordered east, north.',
      },
    ],
  },
  scoreCompatibility: [
    {
      scoreId: WEATHER_SCORE_ID,
      scoreVersion: WEATHER_SCORE_VERSION,
      supportedStreamSchemas: [STREAM_STATE_SCHEMA_VERSION],
      description: 'Weather Score v1 consumes weather stream samples and stream-state.v1.',
    },
  ],
  defaultScoreId: WEATHER_SCORE_ID,
  fixtures: [
    {
      id: 'open-meteo-london-current-v1',
      module: './fixtures/open-meteo-london-current-v1.ts',
      description: 'Recorded London current weather frame used for deterministic tests.',
    },
  ],
} as const satisfies StreamSourceDefinition;

export const mockSensorStreamSourceDefinition = {
  schemaVersion: STREAM_SOURCE_REGISTRY_SCHEMA_VERSION,
  id: MOCK_SENSOR_STREAM_SOURCE_ID,
  kind: 'sensor',
  displayName: 'Mock local sensor',
  description:
    'Fixture-only local device feed that proves non-weather sources can share the registry boundary.',
  adapter: {
    id: MOCK_SENSOR_ADAPTER_ID,
    version: MOCK_SENSOR_ADAPTER_VERSION,
    packageName: '@world-instrument/adapters',
    description: 'Normalizes recorded mock device motion/contact readings.',
  },
  capabilities: [
    {
      mode: 'fixture',
      description: 'Reads recorded mock device readings from tests or fixtures.',
    },
    {
      mode: 'replay',
      description: 'Replays archived normalized sensor stream frames.',
    },
  ],
  defaultMode: 'fixture',
  mapping: {
    streamKind: 'sensor',
    streamIdPrefix: 'sensor',
    streamSchema: STREAM_STATE_SCHEMA_VERSION,
    description:
      'Sensor payloads map into device motion vectors, contact state, and battery level samples.',
    metadataKeys: ['provider', 'mode', 'device'],
    samples: [
      {
        key: 'acceleration',
        kind: 'vector',
        required: true,
        unit: 'm/s2',
        description: 'Three-axis acceleration ordered x, y, z.',
      },
      {
        key: 'orientation',
        kind: 'vector',
        required: false,
        unit: 'degrees',
        description: 'Three-axis orientation ordered pitch, roll, yaw.',
      },
      {
        key: 'contact',
        kind: 'boolean',
        required: false,
        description: 'Whether the device reports contact with a surface or body.',
      },
      {
        key: 'battery',
        kind: 'numeric',
        required: false,
        unit: 'percent',
        description: 'Device battery level.',
      },
    ],
  },
  scoreCompatibility: [],
  fixtures: [
    {
      id: 'mock-sensor-device-v1',
      description: 'Inline fixture payload shape for future sensor score work.',
    },
  ],
} as const satisfies StreamSourceDefinition;

export const streamSourceRegistry = createStreamSourceRegistry([
  weatherStreamSourceDefinition,
  mockSensorStreamSourceDefinition,
]);

export type RegisteredStreamAdapterConfig = MockSensorAdapterConfig | WeatherAdapterConfig;
export type RegisteredStreamAdapter = MockSensorAdapter | WeatherAdapter;

export function createRegisteredStreamAdapter(
  sourceId: typeof WEATHER_STREAM_SOURCE_ID,
  config: WeatherAdapterConfig,
): WeatherAdapter;
export function createRegisteredStreamAdapter(
  sourceId: typeof MOCK_SENSOR_STREAM_SOURCE_ID,
  config: MockSensorAdapterConfig,
): MockSensorAdapter;
export function createRegisteredStreamAdapter(
  sourceId: string,
  config: RegisteredStreamAdapterConfig,
): StreamAdapter<unknown, RegisteredStreamAdapterConfig>;
export function createRegisteredStreamAdapter(
  sourceId: string,
  config: RegisteredStreamAdapterConfig,
): StreamAdapter<unknown, RegisteredStreamAdapterConfig> {
  switch (sourceId) {
    case WEATHER_STREAM_SOURCE_ID:
      return new WeatherAdapter(config as WeatherAdapterConfig);
    case MOCK_SENSOR_STREAM_SOURCE_ID:
      return new MockSensorAdapter(config as MockSensorAdapterConfig);
    default:
      throw new Error(`Stream source '${sourceId}' is not registered with an adapter factory.`);
  }
}
