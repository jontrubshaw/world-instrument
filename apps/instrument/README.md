# Instrument App

Browser-based live instrument shell for World Instrument.

## Responsibility

- Own the user-facing browser runtime.
- Render deterministic score output as visuals, sound, and supported haptics.
- Provide development-only stream and score inspection tools.
- Keep production display focused on the artwork, not a data dashboard.

## Initial Implementation Notes

- Use Vite + React + TypeScript.
- Use Three.js as the initial WebGL rendering path.
- Web Audio should require explicit user activation before sound starts.
- Haptic output must be constrained by safety limits defined in shared core.

## Local Development

```bash
npm run dev -w @world-instrument/instrument
```

The app shell is intentionally abstract and canvas-first. Debug views can be added later, but raw stream data should not become the primary production experience.
