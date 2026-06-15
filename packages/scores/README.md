# Scores Package

Versioned deterministic score implementations.

## Responsibility

- Translate normalized stream state into output parameters.
- Keep formulas deterministic and replayable.
- Version scores so archived input streams can reproduce historical output.
- Store golden fixtures for score determinism tests.

## Weather Score v1

`weatherScoreV1` maps normalized weather samples into abstract visual, audio, and haptic parameters.
The score publishes explicit `weather-score` / `1.0.0` metadata and is covered by a golden replay
fixture so score output drift is intentional and reviewable.

## Browser Sensor Score v1

`browserSensorScoreV1` maps normalized browser sensor and interaction samples into the same abstract
visual, audio, and haptic parameter surface without routing through the weather score abstraction.
The score publishes explicit `browser-sensor-score` / `1.0.0` metadata and covers pointer, pressure,
motion, orientation, stale, live-fallback, and replay consistency cases in unit tests.
