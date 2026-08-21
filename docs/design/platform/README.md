# Capability tracks (platform)

> Layer model and track definitions: `docs/design/layers.md` §2. Tracks
> are cross-cutting deliverables that consume layer surfaces but are never
> dependencies *of* a layer. This folder holds track design docs as they
> are written; until then the track's design home is this README's pointer
> list.

| Track | Milestone | Design doc | Current state |
|---|---|---|---|
| T-build (multi-phase pipeline) | M6 | `build-pipeline.md` (planned) | PE-phase semantics exist at L0 (`applyPhase`); pipeline surface undesigned. Per maintainer ruling the track names explicit capabilities at each layer. |
| T-tooling (tracing/debugging/introspection) | M7 | `tooling.md` (planned) | `inspect` CLI + introspection surface shipped in v1; tracing/step-through undesigned |
| T-host (environments) | — (continuous) | `host.md` (planned) | Node CLI + browser sandbox live; env-capability contract described in `allegretto/structures.md` §11 |
| T-backend (codegen) | M8 | `codegen.md` (planned) | Aspirational; v1 Phase I outline is revalidation-gated (BACKLOG register) |
| T-perf | — (continuous) | — | Known items banded in BACKLOG |
| T-bootstrap (self-hosting) | M9 | — | Aspirational |
| T-ecosystem (packages) | M10 | — | Aspirational |

T-build design fragments held here until `build-pipeline.md` exists:
phase-gate postconditions scan the expression graph for unresolved
elements before a phase may close; extension modules may consume
bindings internally (e.g. the module system consumes a filesystem);
the phase chain itself is `layers.md` §2.
