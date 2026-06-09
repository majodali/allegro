# Phase I — Code Generation (Plan)

Status: draft for user review. Not yet sliced into commits. First target
fixed: **JavaScript (ESM)**. WASM / native are later backends that reuse
the same lowering.

## Thesis

CLAUDE.md states the project's compilation model directly: **"Partial
evaluation as compilation — each build phase is a partial evaluation step
where phase-specific resources become available."** The build-phase list
names **Emitting** as the phase where *"target configuration, debug
symbols, target-specific optimization"* bind.

Phase I is that Emitting phase. Everything upstream — parse, type
inference, refinement domains, effect inference, totality, proofs — has
already run by the time `evalSource` returns. The residual expression DAG
on each binding is *already partially evaluated*: `x = 3 + 4 * 2` is the
folded constant `11`, not a tree of `bits_add`/`bits_mul`. Codegen's job
is to lower that residual DAG to a target language, and — the Phase I
headline (per the backlog) — to use the **invariants and effects** the
provability arc produces for *aggressive but safe optimization*.

Two falsifiable claims Phase I tests:

1. **PE-as-compilation is real.** The same engine that does type
   inference and proof discharge produces residuals tight enough that a
   straight syntax-directed lowering yields good code with no separate
   optimizer. (The constant-folding above is the trivial witness; I4
   tests the non-trivial version.)
2. **Proofs pay for themselves at codegen.** A fact the kernel already
   proved (a function is `pure`; a value's refinement domain entails a
   bound) licenses an optimization the emitter can apply *soundly*,
   because the proof — not a heuristic — is the warrant.

## Relationship to the concurrent workstream

The other active workstream is **Project 1 — the Planning DSL**
(`.claude/plans/project-1-planning-dsl-design.md`). It touches
`lib/planning.alg`, `src/runtime.ts`, and `src/introspect.ts` (a
counterexample-renderer hook). That work is **Shape 1: spec + verify,
execution external** and explicitly *does not require codegen*.

Codegen is cleanly separable: it consumes the **output** of `evalSource`
(an evaluated `ContextValue` + `CompilationReport`) and never modifies the
evaluation pipeline. All new code lives under `src/codegen/` and a
`codegen/` harness peer-dir. The only shared file is `src/index.ts`, where
Phase I adds an `emit` subcommand branch alongside the existing
`inspect` / `verify` / `obligations` / `propose` / `prove` branches — a
purely additive change with negligible collision surface.

## What "codegen" consumes

`evalSource(source, …)` returns `{ value, evalCtx, compilationReport,
registry }`. The inputs codegen reads:

- **`evalCtx.bindings`** — a `Map<string, Binding>`. Each binding's
  `value` is a residual `Value` (the seven kinds). This is the program.
- **`compilationReport.bindingTypes`** — inferred type name per binding.
- **`compilationReport.notifications`** — used to refuse emission when the
  source has error-severity findings (you don't codegen unsound input).
- Per-value **components** on `MultiValue`s: `type` (erased at runtime,
  consulted for optimization), `effects` (drives I4), refinement
  predicate sets / abstract domains (drives I4).

The seven value kinds map to JS as follows (first-cut, refined per slice):

| Allegro value | JS lowering |
| --- | --- |
| `Bits` (Int) | numeric literal (see Int-width open question) |
| `Bits` (Float) | numeric literal |
| `Bits` (String) | string literal |
| `ComposedFunction(params, body)` | `(p0, p1, …) => <body>` |
| `Expression(prim, args)` | operator / runtime-shim call |
| `Expression(eval_if, [c, t, e])` | `(c ? t() : e())` — thunks inlined |
| `Expression(fn, args)` (fn = composed/symbol) | `fn(args…)` |
| `Context` (Array) | array literal |
| `Context` (Object) | object literal |
| `MultiValue` | emit `primary`; type erased, error component → I2+ |
| `Param` | the param's JS name |
| `Symbol` | resolved away by `resolveSymbols` before codegen; a residual `Symbol` is a free reference → codegen error |

## Design decisions

- **Syntax-directed, no separate IR (yet).** The residual DAG *is* the
  IR. The emitter is a recursive `emit(value): string` walk producing a JS
  expression string, plus a top-level pass over bindings producing
  `const`/function declarations. A dedicated lowering IR is introduced
  only if a backend (WASM) needs it — deferred to I6.
- **Primitives map through a runtime shim.** The arithmetic/comparison/
  logical core lowers to native JS operators inline. Everything else
  (`print`, string methods, array HOFs, type dispatch) lowers to calls
  into a small emitted **prelude** (`__allegro` runtime object). The
  prelude is inlined at the top of the emitted file in I1 (self-contained
  output, no module-resolution concerns); factored into an importable
  `lib/codegen-runtime.js` once it stabilizes (I5).
- **Unmapped primitive ⇒ hard error.** If the emitter meets a primitive
  it doesn't know, it throws a `CodegenError` naming the primitive and
  the binding. No silent wrong output — same "build safety in" posture as
  the rest of the kernel. The skip-list of not-yet-lowered features is
  explicit and tested.
- **Types erased for execution, consulted for optimization.** Standard
  mode wraps every value in a `MultiValue` carrying a type. The emitted JS
  runs on plain JS values, so types are erased at the value level. The
  *type / effect / refinement* metadata is read by I4's optimizer, never
  emitted as runtime checks unless a check couldn't be discharged
  statically.
- **Output validated by behavioral parity.** The correctness bar is:
  emitted-JS stdout === interpreter stdout, for every `tests/*.alg` the
  backend claims to support. This is the codegen analogue of the `bench/`
  discipline — a harness, not just unit tests.

## Proposed slices (smallest → largest)

### I1 — JS backend substrate + arithmetic/control core  ← first slice

**What.** `src/codegen/js.ts` exporting `emitModule(evalCtx, report,
opts) → string`. Lowers:

- Int / Float / String literals.
- `ComposedFunction` → arrow function; `Param` → stable JS name.
- The arithmetic / comparison / logical primitive core (`bits_add`,
  `bits_sub`, `bits_mul`, `bits_div`, `bits_mod`, `bits_eq`, `bits_lt`,
  `bits_gt`, `bits_le`, `bits_ge`, `bits_and`, `bits_or`, `bits_not`,
  and their `typed_*` Standard-mode counterparts) → native JS operators.
- `eval_if` → ternary with inlined branch thunks.
- Direct calls: `Expression(composedFn | resolved-fn, args)` → `f(…)`.
- Recursion (named top-level functions reference each other / themselves).
- `print` → prelude `__allegro.print`.

Plus a minimal inlined prelude and the CLI surface:

```
allegro emit <file> [--out FILE.js] [--run]
```

`--run` pipes the emitted module through `node` and prints its stdout.
Refuses to emit if `reportHasErrors(report)`.

**Validation.** `basics.alg` emits JS whose stdout is exactly the 7 lines
CLAUDE.md pins (`11 / 42 / 120 / 42 / 55 / 42 / 7`). 1 end-to-end test in
`src/test.ts` (emit `basics.alg`, run via `node`, diff stdout) + unit
tests on individual lowerings. Unmapped-primitive path tested to throw.

**Bytes.** ~350–450 LOC across `src/codegen/js.ts` + prelude + CLI wiring.

**Why first.** Fixes the architecture (emitter shape, prelude convention,
parity-validation discipline, CLI) on the smallest program that exercises
literals, functions, recursion, conditionals, and lambdas end-to-end.

### I2 — Typed values, dot dispatch, collections

**What.** `MultiValue` lowering (erase to primary; surface the `error`
component as a JS sentinel/throw to be decided), `type_dispatch` →
prelude method calls (the 17 string methods, `.toString`, Int/Float
methods), Array / Object literals, bracket access, `Array.map/filter/
reduce` → prelude HOFs. Grow the prelude.

**Validation.** Behavioral parity over `tests/types.alg`, `arrays.alg`,
`objects.alg`, `dot-access.alg`, `logical.alg`, `functions.alg`.

**Bytes.** ~400–600 LOC (mostly prelude method bodies).

### I3 — Corpus-parity harness

**What.** A `codegen/` peer-dir (mirroring `bench/`'s out-of-`rootDir`
convention, run via `tsx`) with `runCodegenParity(opts) → ParityReport`:
for each `tests/*.alg`, run interpreter + emitted-JS, diff stdout, record
pass / skip (with reason) / mismatch. `npm run codegen:parity` renders a
table; exit non-zero on any mismatch (skips don't gate). Deterministic
subset pinned by a few `src/test.ts` tests.

**Bytes.** ~250 LOC.

**Why.** Makes "the emitted program means the same thing" a continuously
measured, falsifiable property instead of a per-feature spot check.

### I4 — Effect- and invariant-informed optimization (the Phase I headline)

**What.** Optimization passes, each gated on a *proven* fact with the
un-optimized emission as the always-available fallback:

- **Purity ⇒ reorder / dedup / hoist / dead-code-eliminate.** A binding
  whose value's effect set is `pure` and is never referenced is dropped
  (PE-driven tree-shaking at the binding level). Repeated pure
  subexpressions are CSE'd.
- **Refinement domain ⇒ drop redundant checks.** A `preserveOps` result
  is known-refined; `x + 3` where `x: PositiveInt` already carries the
  domain ⇒ no runtime predicate re-check emitted. A bound discharged by
  `impliesDomain` at compile time emits no guard.
- **Effect-free `eval_if` branch selection** when the condition folded.

Each pass is behavior-preserving by construction (the warrant is a kernel
proof, not a heuristic) and measured: op-count / size delta on a small
corpus, parity unchanged.

**Bytes.** ~400 LOC + tests.

**Why.** This is the slice that justifies doing codegen *in Allegro
specifically* rather than transpiling naively — it's where the provability
arc cashes out as compiler optimizations other languages can't apply
soundly.

### I5 — Module emission + imports + tree-shaking

**What.** Emit one ESM module per `.alg`; lower `import` / `export` to JS
ESM `import` / `export`. The inlined prelude factors out to an importable
`lib/codegen-runtime.js`. Whole-program tree-shaking via PE (unreferenced
exports dropped).

**Bytes.** ~300 LOC.

### I6 — WASM backend (later, out of the JS-first arc)

**What.** A second backend proving the lowering is target-parametric.
Likely the point at which a dedicated lowering IR (between the residual
DAG and the target) earns its keep, plus a memory model for Bits / String
/ Context. Scoped only after I1–I5 land; noted here as the milestone's
stated next target ("expression graph → JavaScript / WASM / native").

## Suggested first chunk

**I1.** It lands the substrate (emitter shape, prelude convention,
parity discipline, `allegro emit` CLI) and proves the end-to-end pipeline
on `basics.alg` against its pinned expected output. After it ships, I2
grows the surface, I3 makes parity continuous, and I4 delivers the
proof-informed-optimization payoff.

## Open design questions (for review)

1. **Int width.** JS `number` (safe to 2^53; simple; matches every
   current test) vs `BigInt` (faithful 64-bit, but viral, slower, and
   changes `print` formatting). **Recommendation:** `number` for I1 with
   a documented caveat; revisit if a test needs full 64-bit semantics.
2. **`error` component at runtime.** Allegro error values propagate
   through operations. In JS this is either a sentinel object threaded
   through every op (faithful, verbose) or a thrown exception (idiomatic
   JS, but changes propagation semantics). **Recommendation:** defer to
   I2; for I1 the core has no error-producing programs.
3. **Prelude packaging.** Inlined prelude string per emitted file (I1,
   self-contained) vs a shared importable runtime (I5). **Recommendation:**
   inline first, extract at I5 — already baked into the slicing.
4. **Harness location.** `codegen/` peer-dir like `bench/` (run via
   `tsx`, outside `tsconfig` `rootDir`) vs folded into `src/test.ts`.
   **Recommendation:** peer-dir, mirroring the established `bench/`
   convention; pin a deterministic subset from `src/test.ts`.
