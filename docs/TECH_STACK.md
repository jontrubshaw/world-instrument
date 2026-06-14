# Tech Stack

## Baseline

- Node: `24` LTS
- npm: bundled with Node 24, with repo engines requiring `>=11`
- Package manager: npm workspaces
- Language: TypeScript

## Application

- Browser app: Vite + React
- Rendering: WebGL-first; choose Three.js or regl before first visual implementation.
- Sound: Web Audio API
- Haptics: browser vibration API first, future hardware adapters later

## Quality

- Unit and contract tests: Vitest
- Browser and visual smoke tests: Playwright
- Lint: ESLint flat config
- Formatting: Prettier
- Type safety: TypeScript strict mode

## Rationale

The browser is the right first runtime because it can combine visuals, sound, local replay, and limited haptics with a low setup burden. Shared packages keep score logic deterministic and testable outside the UI.

Node 24 is the baseline because, as of 2026-06-14, Node 20 is end-of-life, Node 22 has a shorter support runway, Node 24 is LTS through 2028-04-30, and Node 26 is not LTS until 2026-10-28.

This project should not use a Python `.venv` unless a future issue adds Python-specific tooling. Environment isolation for the main app should use Node version management plus npm workspaces.

## Pending Decisions

- Rendering library: Three.js vs regl.
- Weather provider and API credential strategy.
- Snapshot storage format for replay archives.
- CI thresholds for coverage and visual smoke tests.
