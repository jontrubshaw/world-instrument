# World Instrument Agent Notes

This file is the durable project handoff. Keep it current whenever project conventions, issue state, orchestration rules, or technical decisions change.

## Current State

- Repository: https://github.com/jontrubshaw/world-instrument
- Linear project: https://linear.app/jtworks/project/world-instrument-1472eb8e5477
- Linear team: Jtworks
- Local checkout: `/Users/JonathanTrubshaw/Documents/weathart/world-instrument`
- Active implementation branch: none confirmed yet for `JTW-41`; watch for a fresh Cursor PR/branch after release.
- Cursor environment setup is complete.
- Stale pre-setup Cursor draft PRs closed: PR #1 (`cursor/instrument-app-shell-1cf1`) and PR #3 (`cursor/core-contracts-7e26`).
- Local Node environment: Homebrew `node@24` installed; current shell resolves `node` to `v24.16.0` and `npm` to `11.13.0`.

## Linear Issues

- `JTW-11`: Create comprehensive World Instrument project plan. This is the first issue and master planning issue.
- `JTW-12`: Scaffold repository structure and project documentation. Done.
- `JTW-13`: Set up Cursor environment for world-instrument. Done.
- `JTW-14`: Install dependencies and establish CI baseline. Done; PR #7 merged.
- `JTW-15`: Implement core stream, score, and replay contracts. Done; PR #12 merged.
- `JTW-16`: Select visual rendering engine and create instrument app shell. Done; PR #16 merged.
- `JTW-17`: Build first weather adapter and deterministic weather score. Done; PR #20 merged.
- `JTW-18`: Add quality coverage thresholds and refactor review cadence. Done; PR #22 merged.
- `JTW-19`: Decide weather provider and credential strategy. Done.
- `JTW-20`: Document 15-minute PR review fallback policy. Done.
- `JTW-21`: Record Cursor setup completion and stale PR cleanup. Done.
- `JTW-22`: Refresh durable agent handoff after CI baseline and JTW-15 delegation. Done.
- `JTW-23`: Update execution plan for post-setup orchestration phase. Done.
- `JTW-24`: Sync master plan and durable handoff after post-setup planning update. Done.
- `JTW-25`: Document Linear auto-complete mismatch after docs PR. Done.
- `JTW-27`: Document Cursor review handoff requirements. Done.
- `JTW-28`: Document Cursor draft PR ready-for-review handling. Done.
- `JTW-29`: Refresh durable handoff after core merge and visual shell release. Done.
- `JTW-30`: Document backlog exhaustion gap-finding automation behavior. Done.
- `JTW-31`: Refresh durable handoff after app shell merge and weather release. Done.
- `JTW-32`: Refresh durable handoff after weather merge and quality release. Done.
- `JTW-33`: Connect weather score to the visual instrument scene. Done; PR #24 merged. Duplicate Cursor PR #25 closed as superseded.
- `JTW-34`: Add deterministic replay controls and archive playback in the instrument app. Done; PR #27 merged. Duplicate Cursor PR #28 closed as superseded.
- `JTW-35`: Implement the first deterministic Web Audio output layer. Done; PR #30 merged. Duplicate Cursor PR #31 closed as superseded.
- `JTW-36`: Add haptic output abstraction and browser vibration prototype. Done; PR #33 merged. Duplicate Cursor PR #34 closed as superseded.
- `JTW-37`: Sync durable docs after quality merge and gap-driven backlog creation. Done; PR #23 merged.
- `JTW-38`: Refresh durable docs after visual score merge and replay release. Done; PR #26 merged.
- `JTW-39`: Refresh durable docs after replay merge and audio release. Done; PR #29 merged.
- `JTW-40`: Refresh durable docs after audio merge and haptics release. Done; PR #32 merged.
- `JTW-41`: Connect live weather stream mode to the instrument pipeline. In Progress, delegated to Cursor.
- `JTW-42`: Add replay capture and provenance export for generated sessions. Backlog.
- `JTW-43`: Define stream source registry for additional realtime inputs. Backlog.
- `JTW-44`: Update Cursor Cloud environment to install Playwright Chromium. Backlog.
- `JTW-45`: Refresh durable docs after haptics merge and live-weather release. Current docs issue.

## Orchestration Rules

- Use Linear to track all meaningful work.
- Create coding-heavy implementation issues as backlog when planning, but do not assign or delegate them to Cursor until they are ready to start.
- When work is ready to start, assign or delegate coding-heavy implementation issues to Cursor.
- Assign issues that need human attention to Jonny Trubshaw.
- Codex handles orchestration, planning, documentation, lightweight scaffolding, issue decomposition, review coordination, and project hygiene.
- Automatic Codex PR reviews are expected on PR creation and subsequent pushes.
- Do not merge PRs until those reviews complete, except under the 15-minute fallback rule below.
- For docs-only or similarly low-risk orchestration updates, use best judgment: if the PR is clean, has no actionable feedback, and Codex has provided a thumbs-up signal or the change is clearly non-runtime, it can merge without waiting the full review window.
- After pushing to a PR, wait about 10 minutes by default before re-checking automatic Codex review state.
- If a review has not appeared for the latest PR head after 10 minutes, check timestamps and wait another 5 minutes.
- If no latest-head review appears after 15 minutes total, merge when the PR is clean and all known actionable feedback has been addressed.
- Jonny has approved Codex to merge reviewed PRs to `main`.
- Cursor may open coding PRs as drafts. Mark a Cursor draft PR ready for review once Cursor has clearly handed back the initial work and is no longer actively pushing; then begin the normal CI and Codex review wait.
- When Cursor owns a coding issue, review handoffs to Cursor go in the Linear issue thread, not in GitHub PR comments. Mention `@Cursor`, identify the PR and branch, list actionable findings, require same-branch fixes, and ask for `npm run check` before handback.
- After docs PRs that reference implementation issue IDs, verify Linear issue state and attachments. PR #8 was docs-only but briefly auto-completed `JTW-15`; `JTW-15` was restored to Todo and still requires a fresh implementation PR.
- If there is no active implementation PR and no ready backlog issue remains, evaluate the current app against the World Instrument intent and create scoped Linear issues for concrete gaps. Assign human-decision issues to Jonny and only delegate coding-heavy work to Cursor when intentionally ready.
- As problems arise, create Linear issues for them.
- Keep documentation updated when the plan changes.
- Perform periodic refactor reviews to keep the codebase clean.
- Cursor environment setup is complete, but coding-heavy issues should still be assigned to Cursor only when intentionally ready to start.

## People And Agents

- Jonny Trubshaw exists in Linear as `Jonny Trubshaw` / `jontrubshaw`.
- Cursor exists in Linear as `Cursor` / `cursor`.

## Current Technical Decisions

- Runtime baseline: Node `24` LTS. Node 20 is not acceptable because it reached end-of-life on 2026-04-30.
- npm baseline: use the npm version bundled with Node 24; require npm `>=11` unless later tooling proves otherwise.
- `package-lock.json` is included in scaffold PR #2 because the initial quality gate now runs during JTW-12.
- Do not create a Python `.venv` for the main project. This is a TypeScript/browser-first repository; add Python isolation only if a future issue introduces Python tooling.
- Monorepo package manager: npm workspaces.
- Language: TypeScript with strict settings.
- Browser app: Vite + React.
- Shared domain code: packages under `packages/*`.
- Visual rendering: Three.js-backed WebGL.
- Sound output: Web Audio API.
- Test stack: Vitest for unit/contract tests, Playwright for browser and visual smoke tests.
- Quality stack: ESLint, Prettier, TypeScript strict mode.
- CI baseline: GitHub Actions runs `npm ci`, `npm run check`, `npm run build`, installs Playwright Chromium, and runs `npm run test:smoke` on pull requests and pushes to `main`.

## Planned Package Boundaries

- `apps/instrument`: Browser-based instrument shell.
- `packages/core`: Stream state, score contracts, deterministic utilities, replay primitives.
- `packages/scores`: Versioned deterministic score implementations.
- `packages/adapters`: Stream adapters such as weather, news, sensors, and replay.

## Current Work Selection

There is no longer a global pause on Cursor setup. Pick the next issue deliberately, assign/delegate it only when ready, and avoid starting multiple coding-heavy Cursor tasks unless that concurrency is intentional.

Current coding-heavy work is `JTW-41`, delegated to Cursor. Watch for a fresh Cursor branch/PR for live weather mode. Do not release another coding-heavy Cursor issue until this work is resolved and merged or explicitly paused.

## Source Checks

- Official Node schedule checked on 2026-06-14: Node 20 ended 2026-04-30; Node 24 ends 2028-04-30; Node 26 starts LTS 2026-10-28.
- `npm run check` passed locally on 2026-06-14 with Node `v24.16.0` and npm `11.13.0`.
- JTW-14 CI baseline added on 2026-06-14: `.github/workflows/ci.yml` runs `npm ci` and `npm run check`.
- PR #7 (`JTW-14 add CI quality gate`) merged on 2026-06-14 after CI passed and a Codex thumbs-up review signal appeared.
- PR #2 Codex review timing observed on 2026-06-14: about 3-5 minutes for early reviews and about 8 minutes for review of commit `fd0eaf4`; latest commit `d0ca86c` still had no latest-head review after 15 minutes. Use 10 minutes as the default review wait and 15 minutes as the merge fallback threshold.
- PR #1 and PR #3 were closed on 2026-06-14 as stale drafts from the pre-Cursor-setup misfire.
- JTW-15 release-to-Cursor check on 2026-06-14: Linear showed `Todo`, assignee `Jonny Trubshaw`, delegate `Cursor`; `gh pr list` showed no fresh open PR; `git ls-remote --heads origin` showed only `main`, old closed Cursor branches, and the merged Cursor setup branch.
- PR #8 (`JTW-22 refresh durable handoff state`) merged on 2026-06-14 after CI passed; docs-only review exception applied.
- PR #9 (`JTW-23 update post-setup execution plan`) merged on 2026-06-14 after CI passed; docs-only review exception applied.
- JTW-11 master plan issue description was refreshed on 2026-06-14 so Linear no longer describes the project as paused for Cursor setup.
- PR #10 (`JTW-24 sync master plan handoff state`) merged on 2026-06-14 after CI passed; docs-only review exception applied.
- Linear state correction on 2026-06-14: `JTW-15` had been auto-completed after docs PR #8, but was restored to Todo with delegate `Cursor`. Treat stale PR #3 and branch `cursor/core-contracts-7e26` as historical only.
- JTW-15 fresh implementation branch created on 2026-06-14: `cursor/core-contracts-48f1`.
- PR #11 (`JTW-25 document Linear automation mismatch`) merged on 2026-06-14 after CI passed; docs-only review exception applied.
- PR #12 (`Implement core stream, score, and replay contracts`) opened from fresh Cursor branch `cursor/core-contracts-48f1` on 2026-06-14 and merged on 2026-06-14 after CI passed and the latest-head Codex review fallback window elapsed with all known actionable feedback addressed.
- PR #13 (`JTW-27 document Cursor handoff workflow`) and PR #14 (`JTW-28 document Cursor draft PR promotion`) merged on 2026-06-14 after CI passed; docs-only review exception applied.
- JTW-16 was released to Cursor on 2026-06-14 after PR #12 merged. Watch for a fresh Cursor branch/PR, and if it opens as draft, mark ready only after Cursor clearly hands back initial work.
- JTW-16 implementation branch `cursor/instrument-app-shell-dc22` verified locally on 2026-06-14 with Node `v24.16.0` and npm `11.13.0`: `npm run check`, `npm run build`, and `npm run test:smoke` passed. Vite reports an expected initial bundle-size warning because Three.js is included in the first shell.
- PR #16 (`Select rendering path and add instrument app shell`) merged on 2026-06-14 and `JTW-16` was marked Done before `JTW-17` started.
- JTW-17 implementation branch `cursor/weather-stream-path-73db` verified on 2026-06-14 with Node `v24.16.0` and npm `11.13.0`: `npm run check` passed.
- The active PR monitor automation was updated on 2026-06-14 to create new Linear issues from product/app gap analysis when the explicit backlog is empty and no implementation PR is active.
- PR #16 (`JTW-16 select rendering path and add instrument app shell`) merged on 2026-06-14 after CI passed and the latest-head Codex review fallback window elapsed with known actionable feedback addressed.
- JTW-17 was released to Cursor on 2026-06-14 after PR #16 merged. Fixture-first weather adapter and score work should proceed without live credentials; live credential gaps should fail clearly and never put secrets in source control.
- PR #20 (`Build first weather adapter and score`) merged on 2026-06-14 after CI passed and the latest-head Codex review fallback window elapsed with known actionable feedback addressed. `JTW-17` was marked Done; Linear also retained a stale attachment to closed superseded PR #19, so PR #20 was added manually as the correct implementation PR link.
- JTW-18 was released to Cursor on 2026-06-14 after PR #20 merged. Scope is enforceable Vitest coverage thresholds, coherent workspace quality scripts, CI enforcement, `docs/QUALITY.md` rationale, and a reusable refactor review issue template.
- PR #22 (`JTW-18 enforce coverage thresholds and hygiene cadence`) merged on 2026-06-15 after CI passed and the latest-head Codex review fallback window elapsed with no known actionable feedback. `JTW-18` was marked Done.
- The explicit backlog was empty after JTW-18, so on 2026-06-15 the monitor evaluated the app against the World Instrument intent and created `JTW-33` through `JTW-36`: score-driven visual integration, deterministic replay controls, first Web Audio output, and haptic output abstraction.
- JTW-33 was released to Cursor on 2026-06-15 after PR #22 merged. Scope is connecting the existing fixture-first weather adapter and `weatherScoreV1` to the Three.js visual instrument without raw-data dashboard UI.
- JTW-33 produced two independent Cursor PRs on 2026-06-15: PR #24 (`cursor/connect-weather-visuals-bee3`) and PR #25 (`cursor/weather-score-scene-8092`). PR #24 was selected because it kept recorded weather fixture/export behavior in `packages/adapters`, added a reusable visual-parameter mapping layer, and avoided duplicating app-local fixture/raw-readout-heavy UI. PR #25 was closed as superseded.
- PR #24 (`JTW-33 connect weather visuals`) merged on 2026-06-15 after CI passed and the latest-head Codex review fallback window elapsed with no known actionable feedback. `JTW-33` was marked Done.
- JTW-34 was released to Cursor on 2026-06-15 after PR #24 merged. Scope is deterministic replay controls and archive playback in the instrument app: load replay snapshots, play/pause/restart/scrub/step, route replay through the existing weather score and visual mapping, keep controls compact and secondary to the instrument surface, and verify with `npm run check`, `npm run build`, and `npm run test:smoke`.
- JTW-34 produced two independent Cursor PRs on 2026-06-15: PR #27 (`cursor/replay-controls-c493`) and PR #28 (`cursor/replay-controls-c944`). Cursor converged on PR #27 and left PR #28 superseded. PR #28 was closed after PR #27 was marked ready for review.
- PR #27 (`Add deterministic replay controls to instrument app`) merged on 2026-06-15 after CI passed and the latest-head Codex review fallback window elapsed with no known actionable feedback. `JTW-34` was marked Done.
- JTW-35 was released to Cursor on 2026-06-15 after PR #27 merged. Scope is the first deterministic Web Audio output layer: explicit user activation, deterministic score-to-audio parameter mapping, compact start/stop/mute controls, replay-consistent audio state, browser/autoplay constraint documentation if needed, and verification with `npm run check`, `npm run build`, and `npm run test:smoke`. Haptics remain separate in `JTW-36`.
- JTW-35 produced two independent Cursor PRs on 2026-06-15: PR #30 (`cursor/deterministic-audio-layer-bcd8`) and PR #31 (`cursor/web-audio-output-1949`). Cursor converged on PR #30 and left PR #31 superseded. PR #31 was closed after PR #30 was marked ready for review.
- PR #30 (`JTW-35 implement deterministic Web Audio layer`) merged on 2026-06-15 after CI passed and the latest-head Codex review fallback window elapsed with the known P2 modulation-routing feedback addressed. `JTW-35` was marked Done.
- JTW-36 was released to Cursor on 2026-06-15 after PR #30 merged. Scope is haptics only: haptic output contract, browser vibration adapter where supported, safety limits, capability-aware enable/disable control, deterministic score-to-haptic tests, and verification with `npm run check`, `npm run build`, and `npm run test:smoke`.
- JTW-36 produced two independent Cursor PRs on 2026-06-15: PR #33 (`cursor/haptic-output-1908`) and PR #34 (`cursor/haptic-output-8131`). Cursor converged on PR #33 and left PR #34 superseded. PR #34 was closed after PR #33 was marked ready for review.
- PR #33 (`JTW-36 add haptic output prototype`) merged on 2026-06-15 after CI passed and the latest-head Codex review fallback window elapsed with the known duplicate-play feedback addressed. `JTW-36` was marked Done.
- The explicit backlog was empty after JTW-36, so on 2026-06-15 the monitor evaluated the app against the World Instrument intent and created `JTW-41` through `JTW-44`: live weather mode, replay capture/provenance export, stream source registry, and Cursor Cloud Playwright Chromium setup.
- JTW-41 was released to Cursor on 2026-06-15 after PR #33 merged. Scope is the first live input path: credential-free current weather, normalized stream frames, shared score/visual/audio/haptic mappings, replay fallback, loading/stale/offline/error states, and deterministic behavior for a given normalized frame and seed.

## Cursor Cloud specific instructions

- Node 24 is required (`.npmrc` sets `engine-strict=true`, so npm refuses to run under the wrong major). It is installed via `nvm` and the startup update script already runs `npm install` under Node 24.
- Gotcha: the non-interactive shell used by the agent resolves `node` to a baseline `v22` from `/exec-daemon` that shadows nvm, so commands fail engine-strict checks. A login shell that sources `~/.bashrc` (nvm) already defaults to Node 24. For non-login shells, select Node 24 first, e.g. run `export PATH="$HOME/.nvm/versions/node/v24.16.0/bin:$PATH"` (or `. "$HOME/.nvm/nvm.sh" && nvm use 24`) at the start of a session before any `npm`/`npx` command. Verify with `node --version` showing `v24.x`.
- The instrument app shell runs via Vite in `apps/instrument` with `npm run dev -w @world-instrument/instrument`.
- `npm run check` runs typecheck + lint + format:check + Vitest. Browser smoke coverage runs separately with `npm run test:smoke`, which starts the Vite app through Playwright.
