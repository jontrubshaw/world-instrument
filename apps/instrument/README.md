# Instrument App

Browser-based live instrument shell for World Instrument.

## Responsibility

- Own the user-facing browser runtime.
- Render deterministic score output as visuals, sound, and supported haptics.
- Provide development-only stream and score inspection tools.
- Keep production display focused on the artwork, not a data dashboard.

## Initial Implementation Notes

- Use Vite + React + TypeScript.
- Select the WebGL rendering library before implementing the first visual scene.
- Web Audio should require explicit user activation before sound starts.
- Haptic output must be constrained by safety limits defined in shared core.
