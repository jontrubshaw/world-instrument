# Adapters Package

Stream adapters for live and archived inputs.

## Responsibility

- Connect to external APIs, local sensors, and replay files.
- Convert source-specific payloads into normalized stream state.
- Keep authentication and source-specific failure handling out of scores.
- Provide recorded fixtures for deterministic tests.

## Weather Adapter v1

`WeatherAdapter` supports a fixture mode that reads recorded Open-Meteo-shaped payloads without
credentials and normalizes them into `stream-state.v1`. Live mode accepts credentials through config
or `WORLD_INSTRUMENT_WEATHER_API_KEY`; if no credential is available, reads return a normalized
`error` stream state with structured error metadata.
