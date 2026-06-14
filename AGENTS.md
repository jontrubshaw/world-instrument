# World Instrument Agent Notes

This file is the durable project handoff. Keep it current whenever project conventions, issue state, orchestration rules, or technical decisions change.

## Current State

- Repository: https://github.com/jontrubshaw/world-instrument
- Linear project: https://linear.app/jtworks/project/world-instrument-1472eb8e5477
- Linear team: Jtworks
- Local checkout: `/Users/JonathanTrubshaw/Documents/weathart/world-instrument`
- Active scaffold branch: `jontrubshaw/jtw-12-scaffold-repository-structure-and-project-documentation`
- Active scaffold PR: https://github.com/jontrubshaw/world-instrument/pull/2
- Local Node environment: Homebrew `node@24` installed; current shell resolves `node` to `v24.16.0` and `npm` to `11.13.0`.

## Linear Issues

- `JTW-11`: Create comprehensive World Instrument project plan. This is the first issue and master planning issue.
- `JTW-12`: Scaffold repository structure and project documentation. Current setup issue.
- `JTW-13`: Set up Cursor environment for world-instrument. Assigned to Jonny; runtime implementation pauses on this.
- `JTW-14`: Install dependencies and establish CI baseline. Backlog, unassigned until ready.
- `JTW-15`: Implement core stream, score, and replay contracts. Backlog, unassigned until ready.
- `JTW-16`: Select visual rendering engine and create instrument app shell. Backlog, unassigned until ready.
- `JTW-17`: Build first weather adapter and deterministic weather score. Backlog, unassigned until ready.
- `JTW-18`: Add quality coverage thresholds and refactor review cadence. Backlog, unassigned until ready.
- `JTW-19`: Decide weather provider and credential strategy. Assigned to Jonny.

## Orchestration Rules

- Use Linear to track all meaningful work.
- Create coding-heavy implementation issues as backlog when planning, but do not assign or delegate them to Cursor until they are ready to start.
- When work is ready to start, assign or delegate coding-heavy implementation issues to Cursor.
- Assign issues that need human attention to Jonny Trubshaw.
- Codex handles orchestration, planning, documentation, lightweight scaffolding, issue decomposition, review coordination, and project hygiene.
- Automatic Codex PR reviews are expected on PR creation and subsequent pushes.
- Do not merge PRs until those reviews complete.
- Jonny has approved Codex to merge reviewed PRs to `main`.
- As problems arise, create Linear issues for them.
- Keep documentation updated when the plan changes.
- Perform periodic refactor reviews to keep the codebase clean.
- Do not start runtime feature implementation until the Cursor environment setup issue is complete.

## People And Agents

- Jonny Trubshaw exists in Linear as `Jonny Trubshaw` / `jontrubshaw`.
- Cursor exists in Linear as `Cursor` / `cursor`.

## Current Technical Decisions

- Runtime baseline: Node `24` LTS. Node 20 is not acceptable because it reached end-of-life on 2026-04-30.
- npm baseline: use the npm version bundled with Node 24; require npm `>=11` unless later tooling proves otherwise.
- Do not create a Python `.venv` for the main project. This is a TypeScript/browser-first repository; add Python isolation only if a future issue introduces Python tooling.
- Monorepo package manager: npm workspaces.
- Language: TypeScript with strict settings.
- Browser app: Vite + React.
- Shared domain code: packages under `packages/*`.
- Visual rendering: WebGL-first; choose Three.js or regl before first visual implementation.
- Sound output: Web Audio API.
- Test stack: Vitest for unit/contract tests, Playwright for browser and visual smoke tests.
- Quality stack: ESLint, Prettier, TypeScript strict mode.

## Planned Package Boundaries

- `apps/instrument`: Browser-based instrument shell.
- `packages/core`: Stream state, score contracts, deterministic utilities, replay primitives.
- `packages/scores`: Versioned deterministic score implementations.
- `packages/adapters`: Stream adapters such as weather, news, sensors, and replay.

## Pause Condition

After the repository scaffold is created, create an issue assigned to Jonny Trubshaw to set up the Cursor environment for this repo, then pause before implementation work.

## Source Checks

- Official Node schedule checked on 2026-06-14: Node 20 ended 2026-04-30; Node 24 ends 2028-04-30; Node 26 starts LTS 2026-10-28.
