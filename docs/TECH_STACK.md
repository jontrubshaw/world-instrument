# Tech Stack

## Baseline

- Node: `24` LTS
- npm: bundled with Node 24, with repo engines requiring `>=11`
- Package manager: npm workspaces
- Language: TypeScript

## Application

- Browser app: Vite + React
- Rendering: Three.js over WebGL
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

### Rendering decision

World Instrument should use Three.js as its first visual rendering engine.

Three.js is the stronger fit for the initial instrument shell and near-term scene work because it provides a mature scene graph, cameras, materials, lighting, geometry helpers, render-loop ergonomics, and broad documentation without requiring the project to design low-level WebGL abstractions immediately. That lets early work focus on deterministic score-to-visual mappings, replayable output states, and the feeling of the instrument.

regl remains attractive for tightly controlled shader pipelines and very small abstractions over WebGL. It may be useful later for specialized passes or highly custom procedural scenes, but choosing it first would push more engine architecture, resource lifecycle, and scene composition work into the app before those constraints are proven.

The current app shell therefore treats Three.js as the default rendering path while keeping score contracts renderer-agnostic.

Node 24 is the baseline because, as of 2026-06-14, Node 20 is end-of-life, Node 22 has a shorter support runway, Node 24 is LTS through 2028-04-30, and Node 26 is not LTS until 2026-10-28.

This project should not use a Python `.venv` unless a future issue adds Python-specific tooling. Environment isolation for the main app should use Node version management plus npm workspaces.

## Pending Decisions

- Weather provider and API credential strategy.
- Snapshot storage format for replay archives.
- CI thresholds for coverage and visual smoke tests.
