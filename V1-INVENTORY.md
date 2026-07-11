# V1 feature inventory — migration matrix

> Tier 2 (companion to `BACKLOG.md`). The v1 implementation ran through
> provability Phase H before the 2026-06 review; the shipped feature set
> below (converted from the old BACKLOG's completed-items ledger,
> 2026-07) is the inventory the structures rewrite must disposition.
> **Verdict semantics:** `keep` (carries unchanged), `revalidate` (works
> today; re-examine against the v2 design when its area is touched),
> `rework` (v2 design changes it consciously — owning chunk/plan noted),
> `drop` (dissolved by a design decision), `TBD` (dispositioned when its
> implementation-plan phase runs). Verdicts are filled progressively;
> closing all TBDs is itself a backlog item (M3 sweep).
> Detailed v1 landing narratives: this repo's git history (pre-rebuild
> `BACKLOG.md` and `CLAUDE.md` "What's Next"), migrating to
> `docs/CHANGELOG.md` per PROCESS.

Layer/track tags per `docs/design/layers.md`. Chunk refs per
`.claude/plans/structures-implementation.md`; register refs per
`BACKLOG.md` §revalidation register.

## L0 — evaluator & core

| Feature | Verdict | Notes |
|---|---|---|
| Seven value kinds + MultiValue/Context | rework | The unification itself (Phases 1–4) |
| Recursive evaluator, PE Rules 1+2 | keep | Mechanism unchanged; propagation table replaces per-primitive special cases (C1.5) |
| `primaryOf` eager/lazy asymmetry | rework → drop | Propagation table C1.5; retirement C4.3 (conscious delta) |
| Tail calls (Stage 1) + typed-wrapper TailCall forwarding fix | rework | Wrapper family deleted in C1.5; forwarding subsumed by propagation design |
| Forward-chaining (DepCollector, applyPhase, propagateCompletions) | rework | Future cells (D33) — completion-effects plan |
| Implicit async futures, `delay`/`fetch`, deferred print | rework | Future cells + blocking-read effect (D31/D33) |
| Symbol resolution / lexical scoping (compile-time) | rework | FQN symbols (C5.1) + scope parent chain (C2.1) |
| `eval_when` residual on unresolved subject | keep | |
| Memoization disabled (replaced by forward-chaining) | revalidate | Re-decide after Phase 4 perf data (T-perf) |

## L1 — grammar & loading

| Feature | Verdict | Notes |
|---|---|---|
| Grammar 2 formalism Phases 1–5 (engine, base grammar, analyzer, .alg analyzer port) | keep | Revalidate only primitive renames from the base-surface audit |
| Runtime grammar extension Phases 1/6/6b/7 (`grammar {…}`, `use`, EBNF rules, hygiene, conflict codes) | keep | Decisions recorded in `docs/design/extension/grammar.md` §4; formalism sync registered |
| Earley parser retained for standalone grammars | keep | Retirement is a banded backlog item |
| Lexer/hybrid-parser retirement (grammar2 cutover) | keep | Historical |
| Module loader (resolution, caching, circular detection) + lib-loader pipeline unification | keep | Becomes the formalized L1 loading contract (`modules.md` planned) |
| `use` pre-scanner (shared `use-scanner.ts`) | keep | |

## L2 — type system

| Feature | Verdict | Notes |
|---|---|---|
| Single Type meta-type, shape-aware instanceof/subtypeof, `~` wrap | rework | Shape/knowledge split (C3), kinds (C6); dispatch-through-shape |
| `NominalType` back-compat alias | drop | Retirement decided at C6.3 (conscious delta) |
| Multiple inheritance (deferred design) + NominalType-as-mixin | drop | Dissolved by D40 draw-from (D30); MI memo update pending |
| Member descriptors (`__members`, Method/Field) | rework | Symbol-keyed members + draw-from (C5.2) |
| Interfaces (`Type.interface`, structural conformance) | rework | Lawful interfaces (D38) — equality-and-laws plan |
| Mixins (error-on-conflict) | revalidate | Draw-from covers composition; conflict policy carries |
| Generics (`Array[T]`, memoized constructors, GenericType) | rework | GenericType reframes as the kind of type constructors (D39/D40, C6) |
| Function types + type-variable unification | revalidate | C3 knowledge bounds |
| Union types | revalidate | S5-adjacent |
| UntypedFunction wrapper | revalidate | Transparency (D15/D17) may obsolete it — C4 |
| Any type / bare-generic auto-apply | revalidate | |
| Type constructors (`__construct`) | rework | Constructor authority via channel capabilities (C6.1) |
| Fluent API (extend/where/distinct/constructor), auto-naming | revalidate | Mechanisms persist per `standard/type-system.md` §3; auto-naming formalizes via FQN symbols |
| Refinements (`&`, domains, preserveOps) + abstract-domain lattice | revalidate | Knowledge lattice home (D36) — C3 |
| Binding/param/return type annotations | revalidate | Annotations become knowledge bounds (D36) |
| Pattern matching (when/is/then, destructuring, guards, nested) | revalidate | Loose path = base-name projection (D30); `when` narrowing gap noted in `standard/pattern-matching.md` |
| Full-program inference (evaluation IS inference), return-type inference | keep | Mechanism; details revalidate at C3 |
| Typed literals pass, Bool/Float literals | revalidate | C4 transparency |
| Error values + auto-propagation, None type, `Y of x` access | rework | Error channel (viral) + `channel_read` surface (D28) — C1.4/C1.5 |
| String/Int/Float/Bool/Array/Object methods (incl. Allegro-built map/filter/reduce) | revalidate | S4 collections + dense representation (C4.2) |
| String interpolation, pipe `|>`, logical ops (`&&` purely logical) | keep | |

## L2 — provability capability

| Feature | Verdict | Notes |
|---|---|---|
| A: introspection (`inspect`, ValueSummary, safety grades) | revalidate | Channel internals change what it reads (M4) |
| B: abstract domains + compile-time refinement discharge | revalidate | Knowledge lattice — C3 |
| C: predicate sets, branch refinement, `assert`, `requires`/`ensures`, `Type.invariant` | rework | Facts plane (C2.2) + contracts register → `contracts.md` |
| D1 (all slices): effect labels, Effect meta-type, `&`, effect bounds, polymorphism, PE-driven inference, compile-time deferral | rework | Effects channel (gated writer) C1.5; Effect re-derived through kind recipe C6.2 — `pure subtypeof Effect` flips (conscious delta) |
| E: totality (partial, exhaustiveness, decreases, SCC, HOF edges, counterexamples) | revalidate | `div` effect future (D31); severity-policy reconciliation — totality register |
| F1–F5, F7: Proof meta-type, proof_by_eval/refines/combinators, tactics, quantification, `proven` | revalidate | Proof re-derived via kernel-private authority C6.3; discharge tiers formalize per D34 |
| G pilot: `lib/provable.alg` (23 theorems) | revalidate | Should re-verify unchanged through the rewrite — good canary |
| H1–H4b + bench: PCP schemas, verify/obligations/prove/propose, benchmark corpus | revalidate | Protocol design → pcp register; `src/pcp.ts` + primer are the shipping shape |
| Notification categories + severity tiers | keep | Per-project severity remap still open (banded) |

## L2 — modules & stdlib

| Feature | Verdict | Notes |
|---|---|---|
| Export keyword, typed module objects, encapsulation | revalidate | The L2 half of the module split; S3 visibility interacts |
| `lib/math`, `lib/functional`, `lib/collections` (+ effects tags, refinement pilots) | revalidate | Carry through rewrite; theorems/effects re-verify as canaries |
| Local→system lib resolution, on-demand loading, typed syntax in modules | keep | L1 side |

## Tracks

| Feature | Verdict | Notes |
|---|---|---|
| CLI (`run`, `inspect`, `verify`, `obligations`, `prove`, `propose`) | keep | Surfaces stable; internals follow their features |
| Browser sandbox + async demos (allegrolang.org) | keep | T-host; website loop continues per PROCESS §9 |
| `bench/` harness + corpus | keep | Re-baseline after Phase 6 |
| Test suite (978 green) + `.alg` expect-files | keep | The rewrite's differential oracle; conscious deltas only via PROCESS §6 |
