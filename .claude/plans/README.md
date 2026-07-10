# Plans manifest

Per `docs/PROCESS.md` §4: agents read this manifest before starting feature
work. New plans use **descriptive names** with sequence identifiers
(e.g. `effects-slice2-stage-f.md`); the legacy codenames below predate that
convention and will be renamed/archived during the documentation refactor.

| Plan | Topic | Status | Notes |
|---|---|---|---|
| `structured-values-unification.md` | Structures design discussion — decision log D1–D40 | **landed (design)** | Promoted to `docs/design/structures.md` (draft pending sign-off); archive after ratification |
| `structures-implementation.md` | Structures unification implementation — phases 0–6, boundary-test-first | **draft** | Chunk boundaries pending maintainer approval; BACKLOG rebuild follows this plan |
| `project-1-planning-dsl-design.md` | Vivace pilot 1: planning DSL model + conventions | **active** | Current design target for `lib/planning.alg` |
| `crystal-proving-curry.md` | Provability arc strategy (Phases A–J) | **active (roadmap)** | Design principles promoted to `docs/VISION.md` (2026-06); Phases A–C/E–H status historical; D2–D5, F6, I, J outline still the live roadmap |
| `phase-h-plan.md` | PCP (Proof Collaboration Protocol) | landed (H1–H4b + bench) | Pending: H5 catalog, H6 multi-strategy, H7 effort budgets |
| `phase-f-plan.md` | Proof terms (F1–F7) | landed | Pending: F6 Lean export |
| `phase-e-totality-plan.md` | Totality & termination (Stages 0–6) | landed | |
| `polyphonic-tracing-plotkin.md` | Effects D1 slices 1+2 implementation | landed | Deviations + pending pieces (runtime-fallback config, applyComposed hypothesis test) recorded in `docs/design/effects.md` |
| `harmonic-grounding-tarski.md` | Effects schema & semantics | superseded | Content promoted to `docs/design/effects.md` (2026-06), incl. the `&&`→`&` operator supersession |
| `lucid-discharging-lambek.md` | Phase C contracts/invariants implementation | landed | |
| `dappled-cascading-cantor.md` | Grammar extension Phase 6 syntax | landed | Durable rationale to fold into `docs/design/grammar.md` during refactor |
| `groovy-gathering-micali.md` | Runtime grammar extension Phase 1 | superseded | References pre-grammar2 files that no longer exist; historical only |

Lifecycle: draft → active → landed/superseded → `archive/` (after durable
content is promoted and pending items extracted to `BACKLOG.md`). Archival
pass scheduled as part of the 2026-06 documentation refactor.
