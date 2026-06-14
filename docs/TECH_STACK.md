# Technology Stack

## Browser visual rendering

**Decision: use Three.js for the first WebGL rendering path.**

World Instrument needs a browser renderer that can host abstract, deterministic
visual scenes without forcing the project to build WebGL infrastructure before
the scoring and replay contracts are proven. Three.js is the best fit for this
stage because it gives the app a stable scene graph, cameras, materials,
geometries, renderer lifecycle helpers, and a broad ecosystem while still
allowing custom shaders and lower-level WebGL work when a score needs it.

### Three.js vs regl

| Area | Three.js | regl |
| --- | --- | --- |
| Abstraction level | Batteries-included 3D engine with scene graph, cameras, materials, geometry helpers, loaders, and renderer management. | Thin functional wrapper over WebGL draw calls and state. |
| Fit for initial shell | Lets the browser app reserve a visual stage immediately with little engine code. | Requires more custom rendering architecture before there is a meaningful scene. |
| Deterministic scenes | Scene state can be driven entirely from versioned score outputs; animation clocks and random sources can be isolated by convention. | Excellent for explicit draw-call determinism, but the project would own more rendering primitives and lifecycle code. |
| Shader path | Supports custom shader materials and raw shader materials when needed. | Shader-first model is direct and ergonomic for teams already operating at the WebGL command level. |
| Maintenance cost | Larger dependency, but well documented and widely used. | Smaller dependency, but more project-owned engine code and fewer high-level affordances. |

### Rationale

- The near-term work is to create an instrument shell and later attach visual
  scenes to deterministic scores, not to design a rendering engine.
- Three.js reduces setup cost for cameras, resize behavior, renderer lifecycle,
  and future scene composition.
- The project can still use custom GLSL through Three.js materials when scores
  need shader-specific behavior.
- regl remains a good option for future isolated render passes if a score needs
  explicit low-level draw-call control, but it should not be the primary app
  shell renderer yet.

### Current app package

- `apps/instrument` is a Vite + React browser app.
- Three.js powers the initial abstract WebGL visual stage.
- Playwright provides smoke test scaffolding to verify that the shell loads in a
  browser.
