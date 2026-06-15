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

`browserSensorScoreV1` maps normalized local browser pointer, pressure, motion, and orientation
samples into the same abstract visual, audio, and haptic parameter surface. The score publishes
explicit `browser-sensor-score` / `1.0.0` metadata so sensor captures and replays are no longer
weather-score-driven.
