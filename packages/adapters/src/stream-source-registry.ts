import {
  STREAM_SOURCE_REGISTRY_SCHEMA_VERSION,
  STREAM_STATE_SCHEMA_VERSION,
  createStreamSourceRegistry,
  type StreamAdapter,
  type StreamSourceDefinition,
} from '@world-instrument/core';

import {
  BROWSER_SENSOR_ADAPTER_ID,
  BROWSER_SENSOR_ADAPTER_VERSION,
  BrowserSensorAdapter,
  type BrowserSensorAdapterConfig,
} from './browser-sensor.ts';
import {
  WEATHER_ADAPTER_ID,
  WEATHER_ADAPTER_VERSION,
  WeatherAdapter,
  type WeatherAdapterConfig,
} from './weather.ts';

export const WEATHER_STREAM_SOURCE_ID = WEATHER_ADAPTER_ID;
export const BROWSER_SENSOR_STREAM_SOURCE_ID = BROWSER_SENSOR_ADAPTER_ID;

const WEATHER_SCORE_ID = 'weather-score';
const WEATHER_SCORE_VERSION = '1.0.0';
const SENSOR_SCORE_ID = 'sensor-score';
const SENSOR_SCORE_VERSION = '1.0.0';

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

export const browserSensorStreamSourceDefinition = {
  schemaVersion: STREAM_SOURCE_REGISTRY_SCHEMA_VERSION,
  id: BROWSER_SENSOR_STREAM_SOURCE_ID,
  kind: 'sensor',
  displayName: 'Browser sensors',
  description:
    'Credential-free browser pointer, motion, and orientation frames normalized for local interaction streams.',
  adapter: {
    id: BROWSER_SENSOR_ADAPTER_ID,
    version: BROWSER_SENSOR_ADAPTER_VERSION,
    packageName: '@world-instrument/adapters',
    description:
      'Normalizes pointer interaction with optional DeviceMotion and DeviceOrientation readings.',
  },
  capabilities: [
    {
      mode: 'fixture',
      description:
        'Reads deterministic browser interaction fixtures from tests or package helpers.',
    },
    {
      mode: 'live',
      description:
        'Reads local pointer movement and uses DeviceMotion or DeviceOrientation where supported and permissioned.',
      requiresCredential: false,
    },
    {
      mode: 'replay',
      description: 'Replays archived normalized browser sensor stream frames.',
    },
  ],
  defaultMode: 'live',
  mapping: {
    streamKind: 'sensor',
    streamIdPrefix: 'sensor',
    streamSchema: STREAM_STATE_SCHEMA_VERSION,
    description:
      'Browser sensor payloads map pointer position and movement plus optional motion/orientation into replay-safe samples.',
    metadataKeys: ['provider', 'mode', 'session', 'capability', 'eventCount'],
    samples: [
      {
        key: 'pointerPosition',
        kind: 'vector',
        required: true,
        unit: 'normalized',
        description: 'Two-axis pointer position ordered x, y in viewport-normalized units.',
      },
      {
        key: 'pointerDelta',
        kind: 'vector',
        required: true,
        unit: 'normalized',
        description: 'Two-axis pointer movement delta ordered x, y in viewport-normalized units.',
      },
      {
        key: 'pointerPressure',
        kind: 'numeric',
        required: false,
        unit: 'normalized',
        description: 'Pointer pressure where the browser supplies it.',
      },
      {
        key: 'motion',
        kind: 'vector',
        required: false,
        unit: 'm/s2',
        description: 'Three-axis DeviceMotion acceleration ordered x, y, z.',
      },
      {
        key: 'rotationRate',
        kind: 'vector',
        required: false,
        unit: 'degrees/s',
        description: 'Three-axis DeviceMotion rotation ordered alpha, beta, gamma.',
      },
      {
        key: 'orientation',
        kind: 'vector',
        required: false,
        unit: 'degrees',
        description: 'Three-axis DeviceOrientation angles ordered alpha, beta, gamma.',
      },
      {
        key: 'interactionActive',
        kind: 'boolean',
        required: false,
        description: 'Whether pointer interaction is currently active.',
      },
      {
        key: 'fallbackActive',
        kind: 'boolean',
        required: true,
        description: 'True when pointer or idle fallback is standing in for device sensors.',
      },
      {
        key: 'sensorCapability',
        kind: 'categorical',
        required: true,
        description:
          'Capability summary such as device-sensor, pointer, idle-pointer, or unavailable.',
      },
    ],
  },
  scoreCompatibility: [
    {
      scoreId: SENSOR_SCORE_ID,
      scoreVersion: SENSOR_SCORE_VERSION,
      supportedStreamSchemas: [STREAM_STATE_SCHEMA_VERSION],
      description: 'Sensor Score v1 consumes browser sensor stream samples and stream-state.v1.',
    },
  ],
  defaultScoreId: SENSOR_SCORE_ID,
  fixtures: [
    {
      id: 'browser-pointer-fixture-v1',
      description:
        'Deterministic browser pointer fixture generated by createBrowserSensorFixturePayload.',
    },
  ],
} as const satisfies StreamSourceDefinition;

export const streamSourceRegistry = createStreamSourceRegistry([
  weatherStreamSourceDefinition,
  browserSensorStreamSourceDefinition,
]);

export type RegisteredStreamAdapterConfig = BrowserSensorAdapterConfig | WeatherAdapterConfig;
export type RegisteredStreamAdapter = BrowserSensorAdapter | WeatherAdapter;

export function createRegisteredStreamAdapter(
  sourceId: typeof WEATHER_STREAM_SOURCE_ID,
  config: WeatherAdapterConfig,
): WeatherAdapter;
export function createRegisteredStreamAdapter(
  sourceId: typeof BROWSER_SENSOR_STREAM_SOURCE_ID,
  config: BrowserSensorAdapterConfig,
): BrowserSensorAdapter;
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
    case BROWSER_SENSOR_STREAM_SOURCE_ID:
      return new BrowserSensorAdapter(config as BrowserSensorAdapterConfig);
    default:
      throw new Error(`Stream source '${sourceId}' is not registered with an adapter factory.`);
  }
}
