# Adapters Package

Stream adapters for live and archived inputs.

## Responsibility

- Connect to external APIs, local sensors, and replay files.
- Convert source-specific payloads into normalized stream state.
- Keep authentication and source-specific failure handling out of scores.
- Provide recorded fixtures for deterministic tests.
- Publish stream source registry definitions that describe capabilities, normalized mapping, and score compatibility.

## Stream Source Registry

The package root exports `streamSourceRegistry` plus each concrete `StreamSourceDefinition`.
Registry entries are the extensibility boundary for adding news, sensor, and local-device streams
without bespoke app wiring.

To add a source:

1. Implement or stub a fixture-first adapter that returns `NormalizedStreamState`.
2. Register a `StreamSourceDefinition` with adapter metadata and supported modes:
   - `fixture` for recorded payloads that run in tests and demos;
   - `live` for realtime reads, with `requiresCredential` set when credentials are needed;
   - `replay` when archived normalized frames can reproduce score output.
3. Document the normalized mapping: `source.kind`, `streamId` prefix, `stream-state` schema,
   sample keys/kinds/units, and metadata keys.
4. List compatible deterministic score ids and stream schemas. If no score exists yet, leave
   `scoreCompatibility` empty; follow-on score work can add compatibility without changing the
   adapter contract.
5. Use `createRegisteredStreamAdapter(sourceId, config)` from app/runtime code so source selection
   goes through the registry boundary.

### Registered Sources

| Source id                    | Kind      | Modes                       | Default score   |
| ---------------------------- | --------- | --------------------------- | --------------- |
| `weather.open-meteo`         | `weather` | `fixture`, `live`, `replay` | `weather-score` |
| `sensor.browser-interaction` | `sensor`  | `fixture`, `live`, `replay` | `sensor-score`  |

## Weather Adapter v1

`WeatherAdapter` supports a fixture mode that reads recorded Open-Meteo-shaped payloads without
credentials and normalizes them into `stream-state.v1`. Live mode accepts credentials through config
or `WORLD_INSTRUMENT_WEATHER_API_KEY`; if no credential is available, reads return a normalized
`error` stream state with structured error metadata.

Weather maps to `source.kind = "weather"` and `streamId` values prefixed with `weather:`. Its
normalized samples include `temperature`, `relativeHumidity`, `windSpeed`, `condition`, `isRaining`,
and `windVector`, plus optional supporting weather measurements. `weather-score` v1 declares
compatibility with this mapping through `stream-state.v1`.

## Browser Sensor Adapter v1

`BrowserSensorAdapter` supports deterministic fixtures plus a live app-provided browser sampler. The
live sampler uses pointer movement as the credential-free baseline and includes DeviceMotion or
DeviceOrientation readings when the browser supports them and permission has been granted.

Browser sensors map to `source.kind = "sensor"` and `streamId` values prefixed with `sensor:`. Its
samples are `pointerPosition`, `pointerDelta`, optional `pointerPressure`, optional `motion`,
optional `rotationRate`, optional `orientation`, `interactionActive`, `fallbackActive`, and
`sensorCapability`. Capability and fallback metadata are part of replay-safe normalized stream
state, so captured sessions can explain whether output came from device sensors, pointer fallback, or
idle fallback.

`MockSensorAdapter` remains as a legacy fixture helper for contract tests, but it is no longer an
app-facing registered source.
