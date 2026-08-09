# Plan archive

**History only — never an input to new work** (PROCESS §4), with one
exception: entries in the BACKLOG's **v1 revalidation register** point into
these files as *source material to mine when that register item is worked*.
Reaching into the archive for any other purpose is the confusion this
folder exists to prevent.

## Why these are here (2026-07 triage)

Version-one design and implementation ran through provability Phase H; the
2026-06 review found enough inconsistencies that the project went back to
the drawing board (outcome: the structured-values unification,
`docs/design/structures.md`). These plans are from the v1 push — not
necessarily wrong, but **everything in them requires revalidation against
the new design before reuse**. The 2026-07 documentation audit (four-agent
sweep, recorded in the session log) triaged each plan's content:
**incorporated** into docs, **marked for revalidation** (BACKLOG register),
or **discarded**.

## Triage record

| Plan | V1 role | Triage outcome |
|---|---|---|
| `crystal-proving-curry.md` | Provability arc strategy A–J | Thesis/principles already in `docs/VISION.md` §2/§5. Phase C contract machinery → **register: contracts**. Remaining roadmap (D2–D5, I, J) → **register: roadmap revalidation**. |
| `lucid-discharging-lambek.md` | Phase C contracts/invariants | Entire contract-system design (predicate sets, branch refinement, assert/requires/ensures lowering, sink-based checks, invariant inheritance) → **register: contracts**. Sequencing discarded. |
| `phase-h-plan.md` | PCP protocol H1–H7 | Protocol design (schemas, trivial-pass prevention, hints, catalog, budgets) → **register: PCP**. Implemented shape lives in `src/pcp.ts` + `docs/proving-in-allegro.md`. Sequencing discarded. |
| `phase-f-plan.md` | Proof terms F1–F7 | Surface fully promoted to `docs/proving-in-allegro.md` earlier. F6 Lean-export mapping → **register: roadmap revalidation**. Rest discarded. |
| `phase-e-totality-plan.md` | Totality Stages 0–6 | Current-arc analyzer decisions (severity policy, exhaustiveness taxonomy, mutual-recursion design, totality polymorphism) → **register: totality** (incl. the severity-policy tension with `structures.md` D34). Sequencing discarded. |
| `harmonic-grounding-tarski.md` | Effects schema & semantics | Fully promoted to `docs/design/effects.md` (2026-06), verified by audit. One rationale sentence → **register: effects nits**. |
| `polyphonic-tracing-plotkin.md` | Effects D1 implementation | Deviations recorded in `docs/design/effects.md`, verified. `applyComposed` tracing hypothesis → **register: effects nits**. Rest discarded. |
| `dappled-cascading-cantor.md` | Grammar extension Phase 6 syntax | Shipped decisions (base-chain compatibility, `W_PRODUCTION_REPLACED` ruling, keyword-reservation tradeoff) **incorporated** into `docs/design/grammar.md` §4 (2026-07). Never-shipped pieces (`combine`/`override`/`without`, restricted-`use` whitelist) → **register: grammar formalism sync** (Phase 8 scope). Rest discarded. |
| `groovy-gathering-micali.md` | Grammar extension Phase 1 | **Discarded** — pre-grammar2, superseded; audit verified its one durable idea (parse-time no-eval template substitution) carried into Phase 6 docs. |
| `project-1-planning-dsl-design.md` | Vivace pilot 1: planning DSL | Settled v1 design (outcome-DAG model, 12 conventions, rejections, `SoftwareRelease` example, Shape 1/2 + pilot roster) → **register: planning DSL** — likely mostly substrate-orthogonal, revalidate before creating `docs/design/planning-dsl.md`. |
| `structured-values-unification.md` | v2 structures design discussion — decision log D1–D46 | **COMPLETE** (not v1 material — archived 2026-08, B-002): every decision executed or pinned to a named backlog owner. Load-bearing tables inlined as `docs/design/allegretto/structures.md` Appendices A–C. Decision numbers (D1–D46) remain citable; this file is the rationale record. |

Register items now live in `BACKLOG.md` as `[reval]`-tagged backlog entries (IDs stable).
