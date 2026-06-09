# Harmonic Grounding — Tarski

**Effects schema and subversion semantics. Settles surface and semantics for Phase D effects before implementation.**

This doc settles the *what* and *why* of effects. Its companion, `polyphonic-tracing-plotkin.md`, settles the *how* (chunk 2+3 implementation). Polyphonic-tracing is downstream of harmonic-grounding — implementation should not start until this design stabilizes.

Tarski for the model-theoretic angle: effects as typed values, lattice operations as predicate entailment, semantics defined by what an Effect *denotes* in the universe of program behaviors.

---

## Settled architectural commitments

1. **Effects are values of type `Effect`.** Not a parallel namespace, not flat string labels. Effect bindings (`pure`, `io`, `files`) are values; the existing value/type/generic/member-dispatch/method-call machinery does the rest.
2. **`pure` and `opaque` are core absolutes.** Like `None` and `Any` for types — fixed, in the language core. Everything else lives in libraries.
3. **Effect bounds live in the predicate set.** `EffectSet` does not become a parallel data structure. Effect predicates carry `source: "effects-bound"` (declared) or `source: "effects-inferred"` (derived) and live alongside refinement, requires, ensures, invariant predicates.
4. **Concrete-arg propagation is effect polymorphism over values.** A residual `effects files.read_from p` carries `p` symbolically; specialization on call is just predicate evaluation under PE.
5. **Redefining primitives or core types is banned at the language level.** Extensions allowed, but extensions cannot be forced on unwitting consumers. No `replaces_primitive` effect needed — the operation simply doesn't exist.
6. **Operations that escape analysis are tracked via the `unsafe` effect hierarchy.** Honest about its limits: declaration is part of the contract; the analyzer can't verify the unsafe step itself.

---

## Schema

### Effect as a value

```
Effect : Type
pure : Effect              // empty atom; lattice bottom
opaque : Effect            // top of "knowable" effects; means "I don't know"
io : Effect                // library-defined
files : Effect             // library-defined
files.read : Effect        // member access
files.read_from : Effect   // parameterized — applies to a path
files.read_from "./config.json" : Effect    // specialized
```

Member access (`files.read`) is structurally identical to property access on an Object — `Effect` values are Contexts whose members are themselves `Effect` values, scoped to the parent.

Parameterization (`files.read_from "X"`) is structurally identical to generic type application — `files.read_from` is a function from arguments to refined `Effect` values, memoized like `Array[Int]`.

### Composition and lattice operations

**Composition via conjunction.** Two Effects compose into a single Effect via conjunction (`&&`). `io && time` is a single Effect representing "does both io and time." This unifies the representation: there is no separate "effect set" data type — compound effects are just conjunctions of simpler ones. `pure` is the empty conjunction (identity element); `opaque` is the universal Effect.

`&&` is already overloaded in Allegro — logical AND, refinement-with-predicate when the left operand is a Type. Effect conjunction is a third dispatch case, when the left operand has meta-type `Effect`. Same overload pattern.

PE simplifies conjunctions automatically via existing expression simplification — `e && e == e` (idempotent), `pure && e == e` (identity). No special effect-arithmetic infrastructure.

**Comparison via lattice methods.** `Effect` exposes typed methods:

- `a.subset_of(b)` — does `a` imply `b`?
- `a.implies(b)` — synonym (cleaner reading)
- `a.intersect(b)` — meet
- `a.union(b)` — join

Implication rules:
- Same qualified-name path with arg implication → implies
- Prefix path → implies (`files.read_from "X"` implies `files.read` implies `files`)
- Argument specialization → implies (literal `"X"` implies any `files.read_from`)
- `pure` implies nothing else (and nothing else implies `pure` except `pure`)
- `opaque` is implied by everything (top); `pure` is implied only by itself (bottom)

For compound Effects: `(a && b) ⊆ c` iff every atom in the conjunction `a && b` is implied by some atom of `c`. Declarations like `effects files.read, time.read` are sugar for `effects files.read && time.read`.

### Function declarations

```alg
read_config(path: String): String =>
  effects files.read_from path
  ... // primitive call

double_pos(x: Int) =>
  effects pure
  x * 2

log_each(arr, f: io) =>
  effects io
  arr.map(f)
```

The `effects` body-form clause from Phase D1 chunk 1 still works. Argument forms (`files.read_from path`) parse as Effect-value expressions in the clause.

### Function param effect bounds (chunk 2)

Two surfaces, both lower to the same predicate-set entry:

```alg
// Surface A — param-type slot
map_pure(arr, f: pure) =>
  effects pure
  arr.map(f)

// Surface C — body-form clause
process(arr, f: SomeNonEffectType) =>
  effects io
  param_effects f: io
  print("processing")
  arr.map(f)
```

### Effect polymorphism (chunk 3)

Effect variables are declared in a generic parameter list `[e: Effect]` after the function name — same syntax as type parameters, since they play the same role:

```alg
// Stdlib: Array.map propagates the callback's effects
map[A, B, e: Effect](arr: Array[A], f: (A) => B && e): Array[B] && e

// Multi-variable: compose chains effects via conjunction
compose[A, B, C, e1: Effect, e2: Effect]
  (f: (B) => C && e2, g: (A) => B && e1): (A) => C && (e1 && e2)

// Caller: e binds to print's effects (io); propagates to caller's bound
caller(arr) =>
  effects io
  arr.map(print)
```

The `[e: Effect]` declaration generalizes Allegro's existing implicit type-variable mechanics: `head[T](arr: Array[T])` is the explicit form of `head(arr: Array[T])`. The explicit form is useful (and for effect variables effectively required) when:

- An implicit name would collide with a binding in scope. Lowercase identifiers are effect names by convention, so `f: e` with bare `e` would resolve to whatever `e` is in scope — silent capture. `[e: Effect]` declares a fresh variable.
- You want to constrain the variable's kind (`T: Type`, `e: Effect`, future kinds).

For type variables the explicit form is optional (PascalCase rarely collides); for effect variables it's the standard form.

**Auto-promotion.** Unannotated function-typed params get a fresh effect variable automatically — falls out of the existing type-variable mechanism. An unannotated function param has an unresolved effect-bound slot, treated as a fresh variable. The variable propagates through the function's inferred effect set and binds at call time. Explicit `[e: Effect]` declaration is for clarity and contract honesty, not soundness — both forms produce equivalent effect inference.

**Multi-variable, alias tracking, effect expressions** — all in scope. Effects are values; any valid expression producing an Effect is allowed (`if cond then io else pure`, `e1 && e2`, method calls on Effect, etc.). PE handles concrete cases; residuals handle symbolic. No special type-level lattice infrastructure beyond what expression evaluation provides.

---

## Standard effect inventory (proposed)

To stabilize during chunk 2+3 implementation. Per `feedback_review_and_redo.md`, this will be reviewed against a real corpus and probably redefined from scratch.

### Core (in language)
- `pure` — no observable effects
- `opaque` — effects unknown / not analyzable

### Standard library
- `lib/io.alg` — `io`, `console.{read,write,write_line,read_line}`
- `lib/files.alg` — `files`, `files.{read,read_from,write,write_to,list,delete}` parameterized by paths
- `lib/net.alg` — `net`, `net.{fetch,fetch_from,listen,send_to}` parameterized by URLs/addresses
- `lib/time.alg` — `time`, `time.{read,sleep,schedule}`
- `lib/rand.alg` — `rand`, `rand.{next,seed}`
- `lib/process.alg` — `process`, `process.{spawn,exit,signal}`
- `lib/refs.alg` (when refs land) — `mutation`, `mutation.{read_ref R, write_ref R}` parameterized by reference identity
- `lib/unsafe.alg` — see § Subversion below

### Domain examples (third-party)
- `auth.read_user`, `auth.update_role`, `auth.update Authorization.access_rules`
- `db.read T`, `db.write T`, `db.transaction`
- `service.call S`, `service.update S`
- `build.spawn_process`, `build.write_artifact`

---

## Subversion analysis

Six attack vectors and their dispositions:

| Vector | Disposition |
|---|---|
| Replacing primitives' implementations | **Banned at language level.** Extensions allowed, but extensions can't be forced on unwitting consumers. |
| Module-init side effects | **Module has its own effect surface.** Importing inherits init-time effects. |
| Dynamic function construction (`eval`-from-text) | **Constructed function has `opaque` effect.** Caller must explicitly accept. |
| Mutable global state | **Tracked via `mutation.read_ref R` / `mutation.write_ref R`** when refs land. |
| Reflection / runtime function lookup | **Produces `opaque` effect.** Restricted in code claiming `pure`. |
| FFI / native code / direct memory / executable modification / runtime codegen | **Tracked via `unsafe.*` hierarchy.** See below. |

### Position in the lattice

`pure`, `opaque`, and `unsafe.*` are **points in the same lattice**, differing only by specificity:

- **`pure`** = bottom (empty effect set; the most constraining bound). Nothing is implied by `pure` except `pure`.
- **`opaque`** = top (universal set; the least constraining bound; "anything goes"). Everything implies `opaque`.
- **`unsafe.*`** = points between, more specific than `opaque` but still describing unanalyzable activity. `unsafe.ffi ⊆ unsafe ⊆ opaque` by the prefix-path implication rule.

All three (and indeed all effects) are values of type `Effect`. All can be declared; all can be inferred. There is no categorical distinction between "analyzer-assigned" and "author-declared" — the same lattice and the same predicate machinery handle both.

What distinguishes the unanalyzable points (`unsafe.*`, `opaque`) from the verifiable ones (`pure`, `io`, `files.*`, etc.) is just **how the analyzer treats the body**: for unanalyzable effects, the body cannot be verified to match the declaration, so the declaration is accepted on author authority. For verifiable effects, the body's primitive calls are inferred and checked against the declaration.

### The `unsafe` hierarchy

```
opaque                    // top of the entire lattice
  unsafe                  // sublattice: unanalyzable activity
    unsafe.memory         // direct memory writes
    unsafe.executable     // modify running executable
    unsafe.codegen        // generate code that is then executed
    unsafe.ffi            // foreign function call out
  // (other middle-region effects also live under opaque: io, files.*, net.*, etc.)
pure                      // bottom
```

The hierarchy is meaningful as a lattice constraint, not just documentation: a function doing both FFI and direct memory has effects `{unsafe.ffi, unsafe.memory}`, which does NOT satisfy a bound of just `unsafe.ffi` (because `unsafe.memory` isn't implied by `unsafe.ffi`). Declaring `unsafe.ffi` is a *tighter* (more informative) claim than declaring `opaque`.

Critical design property: a function with an `unsafe.*` effect can still declare other effect bounds in the same set. "I do unsafe FFI AND my net behavior fits within `files.read_from "X"`." The author bears the proof obligation externally for the unsafe step. See § Open question on wrap-pattern mechanics for how this is expressed mechanically.

### A calls B, B declared `unsafe`

If function A calls function B and B has `effects unsafe`, A's inferred effects include `unsafe`. A's options for its own declaration:

1. `effects unsafe` — propagate upward. A is itself marked unsafe; A's callers inherit further.
2. `effects opaque` — propagate with less specificity (generalization, less informative).
3. *Wrap with author claim:* declare a tighter bound such as `effects files.read_from "X"`. This asserts that A's net behavior is captured by the tighter bound despite calling unsafe code. The author bears the proof obligation; mechanism is open (see open questions).
4. `effects pure` — **rejected**. `unsafe ⊄ pure`.

### Safe-API-over-unsafe-impl is the encapsulation pattern

The wrapper consumes the `unsafe.*` effect; callers see only the safe wrapper. Examples:

- `lib/files.alg`'s `read_from` is implemented via `unsafe.ffi`, but the wrapper claims only `files.read_from "X"`. Callers of `files.read_from` don't inherit `unsafe.ffi` — that's the encapsulation point.
- A JIT compiler that synthesizes new code can be wrapped to operate within a constrained code arena. The wrapper consumes `unsafe.codegen` and exposes a safer effect like `jit.compile_module`.
- A debugger reads/writes process memory; the safe wrapper consumes `unsafe.memory` and exposes `mutation.write_ref process`.

This pattern is structurally the same as Rust's safe-API-over-`unsafe`-block idiom. The encapsulation point is a contract claim that the author bears responsibility for.

---

## Open design questions (deferred)

These don't block chunk 2+3 but should be tracked.

1. **Declaration surface for new effects.** Is it value bindings (`io = Effect.new(...)`)? A keyword form (`effect files { read; read_from }`)? A combination? Defer until the broader declaration-keyword pattern crystallizes (see also `design_type_definitions.md` "fluent API first, syntax later").

2. **Multi-variable polymorphism.** Functions like `compose[e1: Effect, e2: Effect](f: e1, g: e2): e1 ∪ e2` — out of scope for chunk 3 per polyphonic-tracing-plotkin; revisit when concrete need emerges. The `[…]` declaration syntax already supports multiple variables; the deferred work is the lattice operations (union) at the type level.

3. **Effect arithmetic.** Conditional effect dependencies, transformations — out of scope. Keep effects as a simple lattice for now.

4. **Module-init effect surface.** How are init effects declared and propagated? When a module imports another with init effects, are those propagated to the importer's init surface, or aggregated separately? Probably the former, but exact mechanics deferred until module overhaul.

5. **Per-binding notification suppression.** Project config only for now (per chunk 2+3 plan); revisit if a strong use case emerges.

6. **Wrap-pattern mechanics.** When an author wraps an unsafe operation behind a tighter effect bound (the "safe-API-over-unsafe-impl" pattern), how is the tighter claim mechanically expressed? Naive inference would propagate `unsafe.*` upward; the wrap requires re-stating a more specific bound on author authority — analogous to how refinement-type post-conditions sometimes can't be derived from the body and must be accepted as a claim. Possibilities: an explicit `effect_claim` body-form clause; a re-tagging primitive (`assert_effects(B, files.read_from p)`); or a predicate-level claim discharged via PE where possible and accepted as runtime-or-external-proof otherwise. Decide before chunk 2+3 ships if practical use cases arise; otherwise defer.

---

## Relationship to polyphonic-tracing-plotkin

This doc settles **what** effects are and **why**. `polyphonic-tracing-plotkin.md` settles **how** to implement higher-order effect annotations and effect polymorphism (chunks 2+3 of Phase D1).

Order of work:
1. Stabilize this doc — review, refine, lock the core schema decisions.
2. Update polyphonic-tracing-plotkin if any architectural commitment shifts (most won't, since plotkin already uses the unified-predicate-set framing).
3. Slice plotkin into chunks; implement.
4. Build a corpus during implementation.
5. Per `feedback_review_and_redo.md`, schedule a review of both docs once the corpus is rich enough to reveal what actually works.

---

## What this doc does NOT cover

- Specific implementation details (which file, which AST node) — those belong in `polyphonic-tracing-plotkin.md`.
- Surface syntax for new effect declarations (`effect files { ... }` vs value bindings) — deferred.
- Effect arithmetic, transformations, multi-variable polymorphism — deferred.
- Module-init effect surface mechanics — deferred until module overhaul.
- Performance characteristics of lattice operations under PE — measure during implementation.
