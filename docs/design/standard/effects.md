# Effect system — design

> Tier 1 design doc. Status tags per `docs/design/README.md`.
> Implementation: `src/effects.ts`, `src/types-std.ts` (Effect meta-type),
> evaluator propagation in `src/evaluator.ts`; surface in `lib/effects.alg`.

## 1. Settled architectural commitments

1. **Effects are values of type `Effect`** [implemented] — not a parallel
   namespace, not flat string labels (the Phase D1 flat-label representation
   is the degenerate case: an Effect with no members and no parameters). The
   existing value/type/generic/member-dispatch machinery does the rest.
2. **`pure` and `opaque` are core absolutes** [implemented] — lattice bottom
   and top, fixed in the language core like `None` and `Any`. Everything
   else lives in libraries.
3. **Effects flow through the same engine as every other predicate**
   [implemented] — inference is PE-driven (the standalone walker was deleted
   once PE propagation covered every shape); declared bounds discharge
   through the same entailment path refinements use. This is the thesis's
   falsifiable constraint applied to effects.
4. **Effects describe computations; refinements describe data**
   [implemented] — effects ride the `effects` MultiValue component on
   function values and residuals; refinement predicate sets stay separate.
   Param-level effect bounds use the dedicated `Param.effectBound` slot.
5. **Redefining primitives or core types is banned at the language level**
   [designed] — extensions exist but cannot be forced on unwitting
   consumers, so no "replaces_primitive" effect is needed; the operation
   doesn't exist.
6. **Unanalyzable operations are tracked, honestly, via the `unsafe`
   hierarchy** [designed] — see §5.

## 2. Schema

### Effect values [partial]

```
Effect : Type                       // meta-type            [implemented]
pure : Effect                       // lattice bottom        [implemented]
opaque : Effect                     // lattice top           [implemented]
io, net, time : Effect              // library-defined labels [implemented as flat labels]
sched : Effect                      // scheduling detection (`is_resolved`) [implemented, B-028 F2/D33]
div : Effect                        // divergence — COMPUTED, discharge-only [implemented, B-028 F3/D31/D34]
files.read : Effect                 // member access          [designed]
files.read_from : Effect            // parameterized          [designed]
files.read_from "./config.json"     // specialized            [designed]
```

Member access (`files.read`) is structurally property access on a Context
whose members are themselves Effects, scoped to the parent. Parameterization
(`files.read_from "X"`) is structurally generic-type application —
a function from arguments to refined Effects, memoized like `Array[Int]`.

Concrete-arg propagation is effect polymorphism over values: a function
declaring `effects files.read_from p` carries `p` symbolically; calling with
`p = "./config.json"` specializes via ordinary PE — the same path refinement
predicates take. [designed — this is the Phase D2 "parametric capabilities"
work]

### Composition and the lattice [partial]

Two Effects compose by conjunction into a single Effect: `io & time` is one
Effect meaning "does both." There is no separate effect-set data type —
compound effects are conjunctions; `pure` is the empty conjunction
(identity), `opaque` the universal element.

> **Operator supersession note.** The original design (and the Phase D1
> plans) specified `&&` for effect conjunction, dispatched by left-operand
> meta-type. Slice 2 Stage 0 introduced **`&`** as the dedicated
> type/effect-conjunction operator at its own precedence level, leaving `&&`
> purely logical. `&` is current; `&&`-for-conjunction in older plans is
> historical.

Lattice operations are typed methods on Effect (`subset_of`, `implies`,
`intersect`, `union`) [implemented]. Implication rules [partial — prefix
paths and arg specialization await the member/parameter schema]:

- same qualified path with arg implication → implies
- prefix path → implies (`files.read_from "X"` ⊨ `files.read` ⊨ `files`)
- `pure` is implied only by itself; `opaque` is implied by everything
- compound: `(a & b) ⊆ c` iff every atom of the conjunction is implied by
  some atom of `c`

Anonymous-conjunction representation is not yet built; until it lands,
non-trivial unions coerce to `opaque` (sound over-approximation)
[implemented, interim].

### Declaration surfaces [implemented]

- `effects <labels>` body-form clause — declared set verified ⊇ inferred at
  definition time; under-promising halts compilation.
- Param effect bounds: Surface A (param-type slot, `f: pure`) and Surface C
  (`param_effects f: io` body-form) — both lower to the same bound,
  discharged at call sites through the standard entailment path.
- Effect polymorphism: `[e: Effect]` generic params; the variable binds at
  call sites and propagates through inferred sets. Unannotated
  function-typed params are honestly `opaque`, not silently pure.

  *Why the declaration must be explicit:* lowercase identifiers are effect
  names by convention, so a bare `f: e` annotation would resolve to
  whatever `e` is in scope — **silent capture** of an unrelated binding.
  `[e: Effect]` declares a fresh variable, mirroring `[T]` for type
  variables (where the explicit form stays optional because PascalCase
  rarely collides). The original D1 plan expected auto-promotion to mint a
  fresh effect variable per unannotated param with inference equivalent to
  the explicit form; the shipped behavior is deliberately stricter —
  auto-promotion yields `opaque`, making the explicit `[e: Effect]`
  declaration the contract surface for precise propagation, not an
  optional nicety.
- Inference is automatic for all functions; declaration is optional and
  verified — never trusted.

## 3. Where effects live [partial]

- **Core:** `pure`, `opaque`; plus the two completion labels (B-028):
  `sched` (scheduling detection — `is_resolved` and future non-blocking
  selects; quarantines nondeterminism from the confluent core, D33) and
  `div` (divergence, D31/D34 — a COMPUTED effect: the termination
  analysis writes it into inferred sets, no primitive carries it and no
  runtime handler exists; discharge is the D34 tier spectrum, and
  declarations are contracts — `effects pure` on a possibly-diverging
  function halts).
- **Standard library** [designed — currently flat labels `io`/`net`/`time`
  tagged on print/fetch/delay]: `lib/io.alg`, `lib/files.alg`,
  `lib/net.alg`, `lib/time.alg`, `lib/rand.alg`, `lib/process.alg`,
  `lib/refs.alg` (when mutable references land), `lib/unsafe.alg`.
- **Domain libraries:** `auth.update_role`, `db.write T`, `service.call S`,
  `build.spawn_process`, … — registered by the libraries that own them.
  Effect labels are extensible by design, not a fixed enum.
- Naming via imports; collisions resolve like any other binding collision.

## 4. Subversion analysis [designed]

Six attack vectors and their dispositions:

| Vector | Disposition |
|---|---|
| Replacing primitive implementations | Banned at language level |
| Module-init side effects | The module has its own effect surface; importing inherits it |
| Dynamic function construction (eval-from-text) | Constructed function is `opaque`; caller must accept explicitly |
| Mutable global state | `mutation.read_ref R` / `write_ref R` when refs land |
| Reflection / runtime lookup | Produces `opaque`; restricted in code claiming `pure` |
| FFI / direct memory / runtime codegen | `unsafe.*` hierarchy, below |

## 5. The `unsafe` hierarchy [designed]

`pure`, `opaque`, and `unsafe.*` are points in one lattice differing by
specificity: `unsafe.ffi ⊆ unsafe ⊆ opaque`. What distinguishes
unanalyzable points is only how the analyzer treats the body: the
declaration is accepted on author authority because the body can't be
verified — declaring `unsafe.ffi` is a *tighter, more informative* claim
than `opaque`.

```
opaque
  unsafe
    unsafe.memory      // direct memory writes
    unsafe.executable  // modify running executable
    unsafe.codegen     // generate-then-execute
    unsafe.ffi         // foreign function call
  io, files.*, net.*, …
pure
```

**Safe-API-over-unsafe-impl is the encapsulation pattern** (structurally
Rust's safe-fn-over-`unsafe`-block): `files.read_from` is implemented via
`unsafe.ffi` but the wrapper claims only `files.read_from "X"`; callers
don't inherit `unsafe` — the wrapper is the encapsulation point and its
author bears the proof obligation for the unsafe step externally.

When A calls B and B declares `unsafe`: A propagates `unsafe`, generalizes
to `opaque`, or wraps with a tighter author claim. Declaring `pure` is
rejected (`unsafe ⊄ pure`).

**Open question — wrap-pattern mechanics:** how the tighter claim is
mechanically expressed (an `effect_claim` body-form? a re-tagging primitive?
a predicate-level claim discharged via PE where possible?). Decide when
practical cases arise.

## 6. Other open questions [designed]

- **Declaration surface for new effects** — value bindings vs an
  `effect files { read; read_from }` keyword form. Deferred until the
  broader declaration-syntax pattern crystallizes (`type-system.md` §3,
  fluent-API-first); the corpus-driven redo will settle it.
- **Module-init effect surface** — propagation mechanics deferred to the
  module-system overhaul.
- **Per-binding notification suppression** — project config only, unless a
  strong case emerges. (Per-project severity remap by notification kind is
  a tracked backlog item.)
- **Runtime-effect-check fallback** (`allow | warn | error` project config
  for residual effect predicates at call sites) — designed in the D1 plans,
  not yet built.
- ~~**`applyComposed` compile-time tracing hypothesis** (archived plan P9:
  dynamic-application sites can usually trace to a union of the inputs'
  effects at compile time)~~ — **resolved, validated by construction**
  (Slice 2 F1–F3): effect inference is PE-driven, so `applyComposed`-mediated
  effects trace at compile time wherever PE reaches — precompile stashes
  each function's inferred set, Param-calls read `Param.effectBound`, inline
  lambdas precompile on first evaluation. The predicted fall-through cases
  (functions from runtime text, unannotated forwarded params) are honestly
  `opaque`; their runtime-check fallback is the config item above. No
  separate research piece remains.

---

*Sources: `design_effects_as_values` (memory) and the
`harmonic-grounding-tarski` / `polyphonic-tracing-plotkin` plan docs,
promoted and reconciled 2026-06 (notably the `&` operator supersession).
Implementation history: CHANGELOG (Phase D1 and Slice 2 entries).*
